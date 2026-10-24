"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createSession, getUser, hashPassword } from "@/lib/auth";
import { book, BookingError } from "@/lib/booking";
import { professionalConfig } from "@/lib/profiles/registry";
import { rateLimit } from "@/lib/ratelimit";
import { getImpersonator } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { answersFromForm, missingAnswers, priorityLabel } from "@/lib/triage/engine";
import { careTypesFor, outcomeOf, saveTriage } from "@/lib/triage/service";

const visiblePro = async (slug: string) =>
  db.professional.findFirst({ where: { slug, ...((await getImpersonator()) ? {} : { isPublic: true }) } });

/** Salva a triagem respondida e segue para a recomendação + horários. */
export async function submitTriage(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const tipo = String(form.get("tipo") ?? "");
  const pro = await visiblePro(slug);
  if (!pro) redirect("/");
  const careType = (await careTypesFor(pro)).find((c) => c.key === tipo);
  if (!careType) redirect(`/p/${slug}/agendar`);
  const answers = answersFromForm(careType, form);
  const missing = missingAnswers(careType, answers);
  if (missing.length) {
    redirect(`/p/${slug}/agendar?tipo=${tipo}&erro=${encodeURIComponent(`Responda: ${missing.join("; ")}`)}`);
  }
  const triage = await saveTriage(pro, careType, answers);
  redirect(`/p/${slug}/agendar?triagem=${triage.id}`);
}

const base = z.object({
  slug: z.string(),
  serviceId: z.string(),
  start: z.string().min(1, "Escolha um horário."),
  consent: z.literal("on", { errorMap: () => ({ message: "É preciso autorizar o uso dos seus dados (LGPD) para agendar." }) }),
});
const newAccount = z.object({
  name: z.string().trim().min(2, "Informe seu nome."),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  phone: z.string().trim().min(8, "Informe um telefone para contato."),
  password: z.string().min(8, "A senha precisa de pelo menos 8 caracteres."),
});

export async function bookPublic(form: FormData) {
  const raw = Object.fromEntries(form) as Record<string, string>;
  const back = (msg: string) =>
    redirect(`/p/${raw.slug}/agendar?servico=${raw.serviceId}&horario=${encodeURIComponent(raw.start ?? "")}${raw.triagem ? `&triagem=${raw.triagem}` : ""}&erro=${encodeURIComponent(msg)}`);

  const b = base.safeParse(raw);
  if (!b.success) back(b.error.issues[0].message);
  const pro = await visiblePro(raw.slug);
  if (!pro) redirect("/");
  const triage = raw.triagem
    ? await db.triageResponse.findFirst({ where: { id: raw.triagem, professionalId: pro.id, appointmentId: null } })
    : null;
  if (triage && outcomeOf(triage).stop) back("Pela triagem, o agendamento online não é indicado. Siga a orientação mostrada.");
  const cfg = await professionalConfig(pro);

  let user = await getUser();
  if (user && user.role !== "CLIENT") back("Você está logado como profissional. Saia da conta para agendar como cliente.");
  if (!user) {
    const n = newAccount.safeParse(raw);
    if (!n.success) back(n.error.issues[0].message);
    if (!rateLimit(`signup:${n.data!.email}`, 5)) back("Muitas tentativas. Aguarde alguns minutos.");
    if (await db.user.findUnique({ where: { email: n.data!.email } })) {
      back("Você já tem conta com esse e-mail. Entre para concluir o agendamento.");
    }
    const created = await db.user.create({
      data: { name: n.data!.name, email: n.data!.email, phone: n.data!.phone, role: "CLIENT", passwordHash: await hashPassword(n.data!.password) },
      include: { memberships: true, professional: true },
    });
    await createSession(created.id);
    user = created;
  }

  // Formulário prévio definido pelo perfil do profissional (dispensado quando há triagem).
  const intake: Record<string, string | string[]> = {};
  for (const f of triage ? [] : (cfg.intakeForm?.sections.flatMap((s) => s.fields) ?? [])) {
    const values = form.getAll(`i_${f.key}`).map(String).filter(Boolean);
    if (f.required && !f.showIf && values.length === 0) back(`Responda: ${f.label}`);
    if (values.length) intake[f.key] = f.type === "multiselect" || f.type === "checklist" ? values : values[0];
  }

  const existing = await db.client.findFirst({ where: { orgId: pro.orgId, userId: user!.id } });
  const client = existing
    ? await db.client.update({ where: { id: existing.id }, data: { intake: { ...(existing.intake as object), ...intake } as Prisma.InputJsonValue } })
    : await db.client.create({
        data: { orgId: pro.orgId, userId: user!.id, name: user!.name, email: user!.email, phone: user!.phone, stage: "FIRST_VISIT", intake },
      });
  await db.consent.createMany({
    data: cfg.compliance.consents.map((purpose) => ({ userId: user!.id, purpose: `${purpose} · ${pro.displayName}`, textVersion: "2026-01" })),
  });

  try {
    const outcome = triage ? outcomeOf(triage) : null;
    const appt = await book({
      professionalId: pro.id, serviceId: raw.serviceId, clientId: client.id, startsAt: new Date(raw.start),
      modality: outcome?.modality,
      notes: outcome ? `Triagem: ${triage!.careTypeName}${outcome.priority !== "NORMAL" ? ` · ${priorityLabel[outcome.priority]}` : ""}` : undefined,
    });
    if (triage && outcome) {
      await db.triageResponse.update({ where: { id: triage.id }, data: { clientId: client.id, appointmentId: appt.id } });
      if (outcome.tags.length) {
        await db.client.update({ where: { id: client.id }, data: { tags: [...new Set([...client.tags, ...outcome.tags])] } });
      }
      if (outcome.priority !== "NORMAL") {
        await notify(pro.userId, `${priorityLabel[outcome.priority]}: nova triagem`, `${client.name} · ${triage.careTypeName}. Veja as respostas e alertas no atendimento.`, `/app/atendimentos/${appt.id}`);
      }
    }
    redirect(`/p/${pro.slug}/agendado?id=${appt.id}`);
  } catch (e) {
    if (e instanceof BookingError) back(e.message);
    throw e;
  }
}
