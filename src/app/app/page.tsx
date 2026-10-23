import Link from "next/link";
import { addDays } from "date-fns";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { Alert, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { AppointmentRow } from "@/components/appointment-row";
import { requireProfessional } from "@/lib/auth";
import { db } from "@/lib/db";
import { tenant } from "@/lib/tenant";
import { professionalConfig } from "@/lib/profiles/registry";
import { dateLong, money } from "@/lib/format";

export const metadata = { title: "Hoje" };

export default async function Hoje({ searchParams }: { searchParams: Promise<{ bemvindo?: string }> }) {
  const { professional, orgId } = await requireProfessional();
  const { bemvindo } = await searchParams;
  const tz = professional.timezone;
  const cfg = await professionalConfig(professional);
  const t = cfg.terminology;
  const todayLocal = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  const dayStart = fromZonedTime(`${todayLocal}T00:00:00`, tz);
  const dayEnd = addDays(dayStart, 1);
  const weekEnd = addDays(dayStart, 7);

  const [today, week, pendingRules, pendingConfirm] = await Promise.all([
    tenant(orgId).appointments.list({ professionalId: professional.id, startsAt: { gte: dayStart, lt: dayEnd }, status: { notIn: ["RESCHEDULED"] } }),
    tenant(orgId).appointments.list({ professionalId: professional.id, startsAt: { gte: dayStart, lt: weekEnd }, status: { in: ["PENDING", "CONFIRMED"] } }),
    db.ruleEvent.count({ where: { status: "PENDING_APPROVAL", rule: { orgId } } }),
    db.appointment.count({ where: { orgId, professionalId: professional.id, status: "PENDING", startsAt: { gte: new Date() } } }),
  ]);
  const expected = week.reduce((s, a) => s + a.service.priceCents, 0);

  return (
    <>
      {bemvindo && (
        <div className="mb-6">
          <Alert tone="success">
            Sua agenda está pronta! Já criamos seus serviços, horários (seg a sex, 9h às 18h) e regras. Revise em{" "}
            <Link href="/app/horarios" className="font-semibold underline">Horários</Link> e compartilhe sua{" "}
            <Link href={`/p/${professional.slug}`} className="font-semibold underline">página pública</Link>.
          </Alert>
        </div>
      )}
      <PageHeader
        title={`Olá, ${professional.displayName.split(" ")[0]}`}
        subtitle={dateLong(new Date(), tz)}
        action={<div className="hidden md:block"><ButtonLink href="/app/agendar">+ Novo agendamento</ButtonLink></div>}
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><p className="text-sm text-muted first-letter:uppercase">{t.appointment.plural} hoje</p><p className="mt-1 font-serif text-3xl font-semibold">{today.filter((a) => a.status !== "CANCELED_BY_CLIENT" && a.status !== "CANCELED_BY_PROFESSIONAL").length}</p></Card>
        <Card><p className="text-sm text-muted">Próximos 7 dias</p><p className="mt-1 font-serif text-3xl font-semibold">{week.length}</p></Card>
        <Card><p className="text-sm text-muted">Aguardando confirmação</p><p className="mt-1 font-serif text-3xl font-semibold">{pendingConfirm}</p></Card>
        <Card><p className="text-sm text-muted">Receita prevista (7 dias)</p><p className="mt-1 font-serif text-2xl font-semibold">{money(expected) === "Gratuito" ? "R$ 0,00" : money(expected)}</p></Card>
      </div>

      {pendingRules > 0 && (
        <Link href="/app/regras" className="mb-6 block rounded-2xl border border-accent/40 bg-warning-bg p-4 text-sm text-warning">
          <strong>{pendingRules} {pendingRules === 1 ? "regra aguarda" : "regras aguardam"} sua decisão.</strong> Nada é cancelado sem você confirmar. Ver agora →
        </Link>
      )}

      <h2 className="mb-3 text-xl font-semibold">Agenda de hoje</h2>
      {today.length === 0 ? (
        <EmptyState title="Dia livre por aqui" text={`Nenhum(a) ${t.appointment.singular} marcado(a) para hoje. Que tal compartilhar sua página para receber novos ${t.client.plural}?`} action={<ButtonLink href="/app/agendar" variant="secondary">Agendar agora</ButtonLink>} />
      ) : (
        <div className="space-y-3">
          {today.map((a) => <AppointmentRow key={a.id} a={a} tz={tz} href={`/app/atendimentos/${a.id}`} />)}
        </div>
      )}
    </>
  );
}
