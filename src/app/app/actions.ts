"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fromZonedTime } from "date-fns-tz";
import type { AppointmentStatus, FunnelStage, Modality, Prisma, RuleMode } from "@prisma/client";
import { requireProfessional } from "@/lib/auth";
import { db } from "@/lib/db";
import { tenant } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { book, reschedule, BookingError } from "@/lib/booking";
import { onNoShow, decideEvent, undoEvent } from "@/lib/rules/run";
import { canSeeRecords, professionalConfig } from "@/lib/profiles/registry";
import { profileOverridesSchema, type RuleAction } from "@/lib/profiles/schema";
import { hhmmToMin, slugify } from "@/lib/format";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const fail = (path: string, msg: string): never => redirect(`${path}${path.includes("?") ? "&" : "?"}erro=${encodeURIComponent(msg)}`);

// ---------- Atendimentos ----------

const PRO_STATUSES: AppointmentStatus[] = ["CONFIRMED", "DONE", "NO_SHOW", "CANCELED_BY_PROFESSIONAL", "PENDING"];

export async function setStatus(form: FormData) {
  const { orgId, user } = await requireProfessional();
  const id = str(form, "id");
  const status = str(form, "status") as AppointmentStatus;
  if (!PRO_STATUSES.includes(status)) return;
  const appt = await tenant(orgId).appointments.get(id);
  if (!appt) return;
  await tenant(orgId).appointments.setStatus(id, status, status === "CANCELED_BY_PROFESSIONAL" ? str(form, "reason") || undefined : undefined);
  await audit({ orgId, userId: user.id, action: `appointment.${status.toLowerCase()}`, entity: "Appointment", entityId: id });

  if (status === "NO_SHOW") await onNoShow(id);
  if (status === "DONE") {
    await tenant(orgId).clients.update(appt.clientId, { stage: "ACTIVE" });
    await notify(appt.client.userId, "Como foi seu atendimento?", `Conte como foi ${appt.service.name}. Sua avaliação ajuda outras pessoas.`, `/minha-conta/avaliar/${appt.id}`);
  }
  if (status === "CANCELED_BY_PROFESSIONAL") {
    await notify(appt.client.userId, "Atendimento cancelado", `${appt.service.name} foi cancelado pelo profissional. Escolha um novo horário quando quiser.`, "/minha-conta");
  }
  revalidatePath("/app", "layout");
}

export async function rescheduleAppointment(form: FormData) {
  const { orgId, user } = await requireProfessional();
  const id = str(form, "id");
  if (!(await tenant(orgId).appointments.get(id))) return;
  const start = str(form, "start");
  if (!start) fail(`/app/atendimentos/${id}`, "Escolha um novo horário.");
  try {
    const next = await reschedule(id, new Date(start), { userId: user.id, byProfessional: true });
    redirect(`/app/atendimentos/${next.id}?ok=remarcado`);
  } catch (e) {
    if (e instanceof BookingError) fail(`/app/atendimentos/${id}`, e.message);
    throw e;
  }
}

export async function createAppointment(form: FormData) {
  const { orgId, professional } = await requireProfessional();
  const serviceId = str(form, "serviceId");
  let clientId = str(form, "clientId");
  const back = `/app/agendar?servico=${serviceId}&cliente=${clientId}`;

  if (!clientId || clientId === "novo") {
    const name = str(form, "clientName");
    if (!name) fail(back, "Informe o nome do cliente.");
    const created = await db.client.create({
      data: { orgId, name, email: str(form, "clientEmail") || null, phone: str(form, "clientPhone") || null, stage: "FIRST_VISIT" },
    });
    clientId = created.id;
  }
  if (!(await tenant(orgId).clients.get(clientId))) fail(back, "Cliente não encontrado.");

  const manual = str(form, "manual"); // datetime-local, no fuso do profissional
  const slot = str(form, "start");
  const startsAt = manual ? fromZonedTime(manual, professional.timezone) : slot ? new Date(slot) : null;
  if (!startsAt) fail(back, "Escolha um horário.");

  try {
    const appt = await book({ professionalId: professional.id, serviceId, clientId, startsAt: startsAt!, byProfessional: true, notes: str(form, "notes") || undefined });
    redirect(`/app/atendimentos/${appt.id}?ok=criado`);
  } catch (e) {
    if (e instanceof BookingError) fail(back, e.message);
    throw e;
  }
}

export async function saveRecord(form: FormData) {
  const { orgId, professional, user, memberRole } = await requireProfessional();
  const appointmentId = str(form, "appointmentId");
  const appt = await tenant(orgId).appointments.get(appointmentId);
  if (!appt) return;
  const cfg = await professionalConfig(professional);
  if (!canSeeRecords(memberRole, cfg)) return;
  const data: Record<string, string | string[]> = {};
  for (const field of cfg.recordTemplate.sections.flatMap((s) => s.fields)) {
    const values = form.getAll(`f_${field.key}`).map(String).filter(Boolean);
    if (field.required && values.length === 0) fail(`/app/atendimentos/${appointmentId}`, `Preencha “${field.label}”.`);
    data[field.key] = field.type === "multiselect" || field.type === "checklist" ? values : values[0] ?? "";
  }
  const rec = await db.attendanceRecord.create({
    data: { orgId, professionalId: professional.id, clientId: appt.clientId, appointmentId, templateVersion: professional.profileVersion, data },
  });
  await audit({ orgId, userId: user.id, action: "record.created", entity: "AttendanceRecord", entityId: rec.id });
  redirect(`/app/atendimentos/${appointmentId}?ok=registro`);
}

// ---------- Clientes ----------

export async function createClient(form: FormData) {
  const { orgId } = await requireProfessional();
  const name = str(form, "name");
  if (!name) fail("/app/clientes/novo", "Informe o nome.");
  const c = await db.client.create({
    data: {
      orgId, name, email: str(form, "email") || null, phone: str(form, "phone") || null,
      birthDate: str(form, "birthDate") ? new Date(str(form, "birthDate")) : null,
      guardianName: str(form, "guardianName") || null,
      tags: str(form, "tags").split(",").map((t) => t.trim()).filter(Boolean),
      notes: str(form, "notes") || null,
    },
  });
  redirect(`/app/clientes/${c.id}`);
}

export async function updateClient(form: FormData) {
  const { orgId, user } = await requireProfessional();
  const id = str(form, "id");
  await tenant(orgId).clients.update(id, {
    tags: str(form, "tags").split(",").map((t) => t.trim()).filter(Boolean),
    notes: str(form, "notes") || null,
    stage: str(form, "stage") as FunnelStage,
    phone: str(form, "phone") || null,
    email: str(form, "email") || null,
  });
  await audit({ orgId, userId: user.id, action: "client.updated", entity: "Client", entityId: id });
  revalidatePath(`/app/clientes/${id}`);
}

// ---------- Serviços ----------

export async function saveService(form: FormData) {
  const { orgId, professional } = await requireProfessional();
  const id = str(form, "id");
  const data = {
    name: str(form, "name"),
    durationMin: Math.max(5, Number(str(form, "durationMin")) || 30),
    priceCents: Math.round(Number(str(form, "price").replace(",", ".")) * 100) || 0,
    modality: (str(form, "modality") || "IN_PERSON") as Modality,
    active: form.get("active") === "on",
  };
  if (!data.name) fail("/app/servicos", "Informe o nome do serviço.");
  if (id) await db.service.updateMany({ where: { id, orgId }, data });
  else await db.service.create({ data: { ...data, active: true, orgId, professionalId: professional.id } });
  revalidatePath("/app/servicos");
}

// ---------- Horários ----------

export async function saveAvailability(form: FormData) {
  const { professional } = await requireProfessional();
  const rows: { professionalId: string; weekday: number; startMin: number; endMin: number }[] = [];
  for (let d = 0; d < 7; d++) {
    if (form.get(`on_${d}`) !== "on") continue;
    for (const i of [0, 1]) {
      const s = str(form, `start_${d}_${i}`);
      const e = str(form, `end_${d}_${i}`);
      if (s && e && hhmmToMin(e) > hhmmToMin(s)) rows.push({ professionalId: professional.id, weekday: d, startMin: hhmmToMin(s), endMin: hhmmToMin(e) });
    }
  }
  await db.$transaction([
    db.availability.deleteMany({ where: { professionalId: professional.id } }),
    db.availability.createMany({ data: rows }),
    db.professional.update({ where: { id: professional.id }, data: { bufferMin: Math.max(0, Number(str(form, "bufferMin")) || 0) } }),
  ]);
  redirect("/app/horarios?ok=1");
}

export async function addTimeOff(form: FormData) {
  const { professional } = await requireProfessional();
  const s = str(form, "start");
  const e = str(form, "end");
  if (!s || !e) fail("/app/horarios", "Informe início e fim do bloqueio.");
  const startsAt = fromZonedTime(s, professional.timezone);
  const endsAt = fromZonedTime(e, professional.timezone);
  if (endsAt <= startsAt) fail("/app/horarios", "O fim precisa ser depois do início.");
  await db.timeOff.create({ data: { professionalId: professional.id, startsAt, endsAt, reason: str(form, "reason") || null } });
  revalidatePath("/app/horarios");
}

export async function removeTimeOff(form: FormData) {
  const { professional } = await requireProfessional();
  await db.timeOff.deleteMany({ where: { id: str(form, "id"), professionalId: professional.id } });
  revalidatePath("/app/horarios");
}

// ---------- Regras ----------

export async function updateRule(form: FormData) {
  const { orgId, user } = await requireProfessional();
  const rule = await tenant(orgId).rules.get(str(form, "id"));
  if (!rule) return;
  const conditions = { ...(rule.conditions as object) } as { consecutiveGte?: number; days?: number };
  if (form.has("consecutiveGte")) conditions.consecutiveGte = Math.max(1, Number(str(form, "consecutiveGte")) || 1);
  if (form.has("days")) conditions.days = Math.max(1, Number(str(form, "days")) || 1);
  const actions = (rule.actions as RuleAction[]).map((a, i) => {
    const message = str(form, `message_${i}`) || a.message;
    if (a.type === "CANCEL_FUTURE") return { ...a, message, graceDays: Math.max(0, Number(str(form, `grace_${i}`)) || a.graceDays) };
    return { ...a, message };
  });
  await db.rule.update({
    where: { id: rule.id },
    data: {
      conditions,
      actions: actions as Prisma.InputJsonValue,
      enabled: form.get("enabled") === "on",
      mode: (str(form, "mode") || rule.mode) as RuleMode,
    },
  });
  await audit({ orgId, userId: user.id, action: "rule.updated", entity: "Rule", entityId: rule.id });
  redirect("/app/regras?ok=1");
}

export async function decideRuleEvent(form: FormData) {
  const { orgId, user } = await requireProfessional();
  await decideEvent(orgId, user.id, str(form, "id"), str(form, "decision") === "approve");
  revalidatePath("/app", "layout");
}

export async function undoRuleEvent(form: FormData) {
  const { orgId, user } = await requireProfessional();
  await undoEvent(orgId, user.id, str(form, "id"));
  revalidatePath("/app/regras");
}

// ---------- Perfil ----------

export async function saveProfile(form: FormData) {
  const { professional } = await requireProfessional();
  const overrides = profileOverridesSchema.parse({
    ...(professional.overrides as object),
    terminology: {
      client: { singular: str(form, "clientSingular"), plural: str(form, "clientPlural") },
      appointment: { singular: str(form, "apptSingular"), plural: str(form, "apptPlural") },
    },
    cancellationPolicy: { minHoursBefore: Math.max(0, Number(str(form, "minHours")) || 0) },
  });
  const slug = slugify(str(form, "slug")) || professional.slug;
  if (slug !== professional.slug && (await db.professional.findUnique({ where: { slug } }))) {
    fail("/app/perfil", "Esse endereço já está em uso. Escolha outro.");
  }
  await db.professional.update({
    where: { id: professional.id },
    data: {
      slug,
      displayName: str(form, "displayName") || professional.displayName,
      headline: str(form, "headline") || null,
      bio: str(form, "bio") || null,
      city: str(form, "city") || null,
      specialties: str(form, "specialties").split(",").map((s) => s.trim()).filter(Boolean),
      registryNumber: str(form, "registryNumber") || null,
      isPublic: form.get("isPublic") === "on",
      overrides,
    },
  });
  redirect("/app/perfil?ok=1");
}

export async function markAllRead() {
  const { user } = await requireProfessional();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/app", "layout");
}
