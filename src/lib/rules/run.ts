import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import type { RuleAction } from "@/lib/profiles/schema";
import { evaluateNoShow, evaluateDaysWithoutReturn, type RuleLike, type RuleOutcome } from "./engine";

const toRuleLike = (r: {
  id: string; key: string; name: string; trigger: string; conditions: unknown; actions: unknown; mode: "SUGGEST" | "AUTO"; enabled: boolean;
}): RuleLike => ({
  ...r,
  conditions: r.conditions as RuleLike["conditions"],
  actions: r.actions as RuleAction[],
});

/** Executa uma ação (já aprovada ou automática). Retorna dados para desfazer. */
export async function executeAction(
  ctx: { orgId: string; professionalUserId: string; clientId: string },
  action: RuleAction,
  message: string,
): Promise<Prisma.InputJsonValue | null> {
  const client = await db.client.findFirstOrThrow({ where: { id: ctx.clientId, orgId: ctx.orgId } });
  switch (action.type) {
    case "NOTIFY_CLIENT":
      await notify(client.userId, "Mensagem do seu profissional", message, "/minha-conta");
      return null;
    case "NOTIFY_PROFESSIONAL":
    case "OPEN_TASK":
      await notify(ctx.professionalUserId, "Regra automática", message, `/app/clientes/${client.id}`);
      return null;
    case "CANCEL_FUTURE": {
      const future = await db.appointment.findMany({
        where: { orgId: ctx.orgId, clientId: client.id, startsAt: { gt: new Date() }, status: { in: ["PENDING", "CONFIRMED"] } },
      });
      await db.appointment.updateMany({
        where: { id: { in: future.map((a) => a.id) } },
        data: { status: "CANCELED_BY_PROFESSIONAL", cancelReason: "Regra automática de faltas" },
      });
      await notify(client.userId, "Atendimentos cancelados", `Seus próximos atendimentos foram cancelados. Fale com o profissional para retomar.`, "/minha-conta");
      return { appointments: future.map((a) => ({ id: a.id, status: a.status })) };
    }
    case "BLOCK_BOOKING": {
      const tags = [...new Set([...client.tags, "bloqueado"])];
      await db.client.update({ where: { id: client.id }, data: { tags } });
      return { tags: client.tags };
    }
  }
}

async function persistOutcomes(
  outcomes: RuleOutcome[],
  ctx: { orgId: string; professionalUserId: string; clientId: string },
) {
  for (const o of outcomes) {
    for (const p of o.actions) {
      if (p.requiresApproval) {
        await db.ruleEvent.create({
          data: { ruleId: o.rule.id, clientId: ctx.clientId, status: "PENDING_APPROVAL", action: p.action, summary: p.message },
        });
        await notify(ctx.professionalUserId, "Regra aguardando sua decisão", p.message, "/app/regras");
      } else {
        const undoData = await executeAction(ctx, p.action, p.message);
        await db.ruleEvent.create({
          data: {
            ruleId: o.rule.id, clientId: ctx.clientId, status: "EXECUTED", action: p.action, summary: p.message,
            undoData: undoData ?? undefined, decidedAt: new Date(),
          },
        });
      }
      await audit({ orgId: ctx.orgId, action: "rule.fired", entity: "Rule", entityId: o.rule.id, meta: { action: p.action.type, approval: p.requiresApproval } });
    }
  }
}

/** Chamado quando um atendimento é marcado como falta. */
export async function onNoShow(appointmentId: string) {
  const appt = await db.appointment.findUniqueOrThrow({
    where: { id: appointmentId },
    include: { client: true, professional: true },
  });
  const rules = await db.rule.findMany({ where: { professionalId: appt.professionalId, trigger: "NO_SHOW" } });
  const history = await db.appointment.findMany({
    where: { clientId: appt.clientId, professionalId: appt.professionalId },
    select: { startsAt: true, status: true },
  });
  const outcomes = evaluateNoShow(rules.map(toRuleLike), history, { clientName: appt.client.name, now: new Date() });
  await persistOutcomes(outcomes, { orgId: appt.orgId, professionalUserId: appt.professional.userId, clientId: appt.clientId });
  return outcomes;
}

/** Varredura diária (cron/job): gatilho "X dias sem retorno". */
export async function runDailyRules(now = new Date()) {
  const rules = await db.rule.findMany({ where: { trigger: "DAYS_WITHOUT_RETURN", enabled: true }, include: { professional: true } });
  let fired = 0;
  for (const rule of rules) {
    const clients = await db.client.findMany({ where: { orgId: rule.orgId } });
    for (const c of clients) {
      const last = await db.appointment.findFirst({
        where: { clientId: c.id, professionalId: rule.professionalId, status: "DONE" },
        orderBy: { startsAt: "desc" },
      });
      const future = await db.appointment.count({
        where: { clientId: c.id, startsAt: { gt: now }, status: { in: ["PENDING", "CONFIRMED"] } },
      });
      const outcomes = evaluateDaysWithoutReturn([toRuleLike(rule)], last?.startsAt ?? null, future > 0, { clientName: c.name, now });
      await persistOutcomes(outcomes, { orgId: rule.orgId, professionalUserId: rule.professional.userId, clientId: c.id });
      fired += outcomes.length;
    }
  }
  return fired;
}

export async function decideEvent(orgId: string, professionalUserId: string, eventId: string, approve: boolean) {
  const ev = await db.ruleEvent.findFirst({ where: { id: eventId, rule: { orgId }, status: "PENDING_APPROVAL" } });
  if (!ev) return;
  if (!approve) {
    await db.ruleEvent.update({ where: { id: ev.id }, data: { status: "DISMISSED", decidedAt: new Date() } });
    return;
  }
  const undoData = await executeAction({ orgId, professionalUserId, clientId: ev.clientId }, ev.action as RuleAction, ev.summary);
  await db.ruleEvent.update({ where: { id: ev.id }, data: { status: "EXECUTED", decidedAt: new Date(), undoData: undoData ?? undefined } });
  await audit({ orgId, userId: professionalUserId, action: "rule.approved", entity: "RuleEvent", entityId: ev.id });
}

export async function undoEvent(orgId: string, userId: string, eventId: string) {
  const ev = await db.ruleEvent.findFirst({ where: { id: eventId, rule: { orgId }, status: "EXECUTED" } });
  if (!ev?.undoData) return;
  const action = ev.action as RuleAction;
  const data = ev.undoData as { appointments?: { id: string; status: string }[]; tags?: string[] };
  if (action.type === "CANCEL_FUTURE" && data.appointments) {
    for (const a of data.appointments) {
      await db.appointment.updateMany({ where: { id: a.id, orgId }, data: { status: a.status as "PENDING", cancelReason: null } });
    }
  }
  if (action.type === "BLOCK_BOOKING" && data.tags) {
    await db.client.updateMany({ where: { id: ev.clientId, orgId }, data: { tags: data.tags } });
  }
  await db.ruleEvent.update({ where: { id: ev.id }, data: { status: "UNDONE" } });
  await audit({ orgId, userId, action: "rule.undone", entity: "RuleEvent", entityId: ev.id });
}
