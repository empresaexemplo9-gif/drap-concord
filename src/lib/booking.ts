import { addMinutes } from "date-fns";
import { db } from "./db";
import { audit } from "./audit";
import { notify } from "./notify";
import { computeSlots } from "./slots";
import { professionalConfig } from "./profiles/registry";
import { bookingDefaults } from "./profiles/schema";
import { dateLong, time } from "./format";

const ACTIVE = ["PENDING", "CONFIRMED"] as const;

export class BookingError extends Error {}

/**
 * Horários livres. Com `client: true` (agendamento feito pelo cliente) valem a
 * antecedência mínima e o limite de dias à frente definidos pelo profissional.
 */
export async function availableSlots(professionalId: string, serviceId: string, days = 14, from = new Date(), opts: { client?: boolean } = {}) {
  const pro = await db.professional.findUniqueOrThrow({
    where: { id: professionalId },
    include: { availability: true, timeOff: true },
  });
  if (opts.client) {
    const b = bookingDefaults(pro.overrides);
    const earliest = addMinutes(new Date(), b.minNoticeHours * 60);
    if (earliest > from) from = earliest;
    days = Math.min(days, b.maxAdvanceDays);
  }
  const service = await db.service.findFirstOrThrow({ where: { id: serviceId, professionalId, active: true } });
  const until = addMinutes(from, days * 24 * 60 + 24 * 60);
  const appts = await db.appointment.findMany({
    where: { professionalId, status: { in: [...ACTIVE] }, startsAt: { lt: until }, endsAt: { gt: from } },
    select: { startsAt: true, endsAt: true },
  });
  return computeSlots({
    from,
    days,
    availability: pro.availability,
    busy: [...appts, ...pro.timeOff],
    durationMin: service.durationMin,
    bufferMin: pro.bufferMin,
    timezone: pro.timezone,
    now: new Date(),
  });
}

async function assertFree(professionalId: string, startsAt: Date, endsAt: Date, ignoreId?: string) {
  const pro = await db.professional.findUniqueOrThrow({ where: { id: professionalId } });
  const buffer = pro.bufferMin * 60_000;
  const clash = await db.appointment.findFirst({
    where: {
      professionalId,
      id: ignoreId ? { not: ignoreId } : undefined,
      status: { in: [...ACTIVE] },
      startsAt: { lt: new Date(endsAt.getTime() + buffer) },
      endsAt: { gt: new Date(startsAt.getTime() - buffer) },
    },
  });
  if (clash) throw new BookingError("Esse horário acabou de ser ocupado. Escolha outro.");
}

export async function book(input: {
  professionalId: string;
  serviceId: string;
  clientId: string;
  startsAt: Date;
  byProfessional?: boolean;
  notes?: string;
  /** Modalidade definida pela triagem (quando difere da modalidade padrão do serviço). */
  modality?: "IN_PERSON" | "ONLINE" | "HOME";
}) {
  const pro = await db.professional.findUniqueOrThrow({ where: { id: input.professionalId } });
  const service = await db.service.findFirstOrThrow({ where: { id: input.serviceId, professionalId: pro.id } });
  const client = await db.client.findFirstOrThrow({ where: { id: input.clientId, orgId: pro.orgId } });
  if (!input.byProfessional && client.tags.includes("bloqueado")) {
    throw new BookingError("Novos agendamentos estão bloqueados. Fale com o profissional.");
  }
  if (!input.byProfessional) {
    const valid = await availableSlots(pro.id, service.id, 365, new Date(), { client: true });
    if (!valid.some((s) => s.getTime() === input.startsAt.getTime())) {
      throw new BookingError("Esse horário não está disponível. Escolha outro.");
    }
  }
  const endsAt = addMinutes(input.startsAt, service.durationMin);
  const appt = await db.$transaction(
    async (tx) => {
      const clash = await tx.appointment.findFirst({
        where: {
          professionalId: pro.id,
          status: { in: [...ACTIVE] },
          startsAt: { lt: addMinutes(endsAt, pro.bufferMin) },
          endsAt: { gt: addMinutes(input.startsAt, -pro.bufferMin) },
        },
      });
      if (clash) throw new BookingError("Esse horário acabou de ser ocupado. Escolha outro.");
      return tx.appointment.create({
        data: {
          orgId: pro.orgId,
          professionalId: pro.id,
          clientId: client.id,
          serviceId: service.id,
          startsAt: input.startsAt,
          endsAt,
          modality: input.modality ?? service.modality,
          status: input.byProfessional || bookingDefaults(pro.overrides).confirmation === "AUTO" ? "CONFIRMED" : "PENDING",
          notes: input.notes,
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
  const when = `${dateLong(input.startsAt, pro.timezone)} às ${time(input.startsAt, pro.timezone)}`;
  if (input.byProfessional) {
    await notify(client.userId, "Novo agendamento", `${service.name} em ${when}. Confirme sua presença.`, "/minha-conta");
  } else {
    await notify(pro.userId, "Novo agendamento", `${client.name} agendou ${service.name} em ${when}.`, "/app/agenda");
  }
  await audit({ orgId: pro.orgId, action: "appointment.created", entity: "Appointment", entityId: appt.id });
  return appt;
}

/** Pode o cliente cancelar/reagendar sozinho, pela política do perfil? */
export async function clientCanChange(appt: { startsAt: Date; professionalId: string }) {
  const pro = await db.professional.findUniqueOrThrow({ where: { id: appt.professionalId } });
  const cfg = await professionalConfig(pro);
  const hours = (appt.startsAt.getTime() - Date.now()) / 3_600_000;
  return { allowed: hours >= cfg.cancellationPolicy.minHoursBefore, minHours: cfg.cancellationPolicy.minHoursBefore };
}

export async function reschedule(appointmentId: string, newStart: Date, actor: { userId: string; byProfessional: boolean }) {
  const old = await db.appointment.findUniqueOrThrow({ where: { id: appointmentId }, include: { service: true, professional: true, client: true } });
  if (!ACTIVE.includes(old.status as (typeof ACTIVE)[number])) throw new BookingError("Esse atendimento não pode mais ser remarcado.");
  if (!actor.byProfessional) {
    const { allowed, minHours } = await clientCanChange(old);
    if (!allowed) throw new BookingError(`Remarcações só com ${minHours}h de antecedência. Fale com o profissional.`);
    const valid = await availableSlots(old.professionalId, old.serviceId, 365, new Date(), { client: true });
    if (!valid.some((s) => s.getTime() === newStart.getTime())) throw new BookingError("Esse horário não está disponível.");
  }
  const endsAt = addMinutes(newStart, old.service.durationMin);
  await assertFree(old.professionalId, newStart, endsAt, old.id);
  const next = await db.$transaction(async (tx) => {
    const created = await tx.appointment.create({
      data: {
        orgId: old.orgId, professionalId: old.professionalId, clientId: old.clientId, serviceId: old.serviceId,
        startsAt: newStart, endsAt, modality: old.modality, status: actor.byProfessional || bookingDefaults(old.professional.overrides).confirmation === "AUTO" ? "CONFIRMED" : "PENDING", notes: old.notes,
      },
    });
    await tx.appointment.update({ where: { id: old.id }, data: { status: "RESCHEDULED", rescheduledToId: created.id } });
    return created;
  });
  const when = `${dateLong(newStart, old.professional.timezone)} às ${time(newStart, old.professional.timezone)}`;
  if (actor.byProfessional) await notify(old.client.userId, "Atendimento remarcado", `${old.service.name} foi remarcado para ${when}.`, "/minha-conta");
  else await notify(old.professional.userId, "Atendimento remarcado", `${old.client.name} remarcou ${old.service.name} para ${when}.`, "/app/agenda");
  await audit({ orgId: old.orgId, userId: actor.userId, action: "appointment.rescheduled", entity: "Appointment", entityId: old.id, meta: { to: next.id } });
  return next;
}

export async function cancelByClient(appointmentId: string, clientUserId: string, reason?: string) {
  const appt = await db.appointment.findFirst({
    where: { id: appointmentId, client: { userId: clientUserId } },
    include: { professional: true, client: true, service: true },
  });
  if (!appt) throw new BookingError("Atendimento não encontrado.");
  if (!ACTIVE.includes(appt.status as (typeof ACTIVE)[number])) throw new BookingError("Esse atendimento já foi encerrado.");
  const { allowed, minHours } = await clientCanChange(appt);
  if (!allowed) throw new BookingError(`Cancelamentos só com ${minHours}h de antecedência. Fale com o profissional.`);
  await db.appointment.update({ where: { id: appt.id }, data: { status: "CANCELED_BY_CLIENT", cancelReason: reason } });
  await notify(appt.professional.userId, "Cancelamento", `${appt.client.name} cancelou ${appt.service.name} de ${dateLong(appt.startsAt)}.`, "/app/agenda");
  await audit({ orgId: appt.orgId, userId: clientUserId, action: "appointment.canceled_by_client", entity: "Appointment", entityId: appt.id });
}

export async function confirmByClient(appointmentId: string, clientUserId: string) {
  const appt = await db.appointment.findFirst({
    where: { id: appointmentId, client: { userId: clientUserId }, status: "PENDING" },
    include: { professional: true, client: true, service: true },
  });
  if (!appt) return;
  await db.appointment.update({ where: { id: appt.id }, data: { status: "CONFIRMED" } });
  await notify(appt.professional.userId, "Presença confirmada", `${appt.client.name} confirmou ${appt.service.name} de ${dateLong(appt.startsAt)}.`, "/app/agenda");
}
