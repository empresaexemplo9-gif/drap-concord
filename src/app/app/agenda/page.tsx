import Link from "next/link";
import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { ButtonLink, EmptyState, PageHeader, cx } from "@/components/ui";
import { AppointmentRow } from "@/components/appointment-row";
import { requireProfessional } from "@/lib/auth";
import { tenant } from "@/lib/tenant";
import { fmt, statusTone, time } from "@/lib/format";

export const metadata = { title: "Agenda" };

const toneBorder: Record<string, string> = {
  warning: "border-l-warning",
  info: "border-l-info",
  success: "border-l-success",
  danger: "border-l-danger",
  neutral: "border-l-line opacity-60",
};

export default async function Agenda({ searchParams }: { searchParams: Promise<{ semana?: string; ver?: string }> }) {
  const { professional, orgId } = await requireProfessional();
  const tz = professional.timezone;
  const { semana, ver } = await searchParams;
  const view = ver === "lista" ? "lista" : "semana";

  const todayLocal = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  const ref = fromZonedTime(`${semana && /^\d{4}-\d{2}-\d{2}$/.test(semana) ? semana : todayLocal}T00:00:00`, tz);
  const isoDow = Number(formatInTimeZone(ref, tz, "i"));
  const monday = addDays(ref, -(isoDow - 1));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const key = (d: Date) => formatInTimeZone(d, tz, "yyyy-MM-dd");

  const appts = await tenant(orgId).appointments.list({
    professionalId: professional.id,
    startsAt: { gte: monday, lt: addDays(monday, 7) },
    status: { not: "RESCHEDULED" },
  });
  const byDay = new Map<string, typeof appts>();
  for (const a of appts) byDay.set(key(a.startsAt), [...(byDay.get(key(a.startsAt)) ?? []), a]);

  const nav = (offset: number) => `/app/agenda?semana=${key(addDays(monday, offset))}&ver=${view}`;

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle={`${fmt(monday, "d 'de' MMM", tz)} a ${fmt(addDays(monday, 6), "d 'de' MMM", tz)}`}
        action={<ButtonLink href="/app/agendar">+ Novo agendamento</ButtonLink>}
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link href={nav(-7)} className="inline-flex min-h-11 items-center rounded-xl border border-line bg-card px-4 text-sm font-medium" aria-label="Semana anterior">←</Link>
        <Link href={`/app/agenda?ver=${view}`} className="inline-flex min-h-11 items-center rounded-xl border border-line bg-card px-4 text-sm font-medium">Hoje</Link>
        <Link href={nav(7)} className="inline-flex min-h-11 items-center rounded-xl border border-line bg-card px-4 text-sm font-medium" aria-label="Próxima semana">→</Link>
        <div className="ml-auto flex rounded-xl border border-line bg-card p-1 text-sm" role="tablist" aria-label="Visualização">
          {(["semana", "lista"] as const).map((v) => (
            <Link key={v} role="tab" aria-selected={view === v} href={`/app/agenda?semana=${key(monday)}&ver=${v}`} className={cx("inline-flex min-h-9 items-center rounded-lg px-3 font-medium capitalize", view === v ? "bg-primary text-on-primary" : "text-muted")}>
              {v}
            </Link>
          ))}
        </div>
      </div>

      {view === "semana" ? (
        <div className="grid gap-3 md:grid-cols-7">
          {days.map((d) => {
            const list = byDay.get(key(d)) ?? [];
            const isToday = key(d) === todayLocal;
            return (
              <section key={key(d)} aria-label={fmt(d, "EEEE d", tz)} className={cx("rounded-2xl border bg-card/60 p-2.5 md:min-h-64", isToday ? "border-primary" : "border-line")}>
                <h2 className="mb-2 flex items-baseline justify-between px-1 font-sans text-sm">
                  <span className="font-semibold capitalize">{fmt(d, "EEE", tz)}</span>
                  <span className={cx("font-serif text-lg", isToday ? "text-primary" : "text-muted")}>{fmt(d, "d", tz)}</span>
                </h2>
                <div className="space-y-1.5">
                  {list.length === 0 && <p className="px-1 text-xs text-muted md:hidden">Livre</p>}
                  {list.map((a) => (
                    <Link key={a.id} href={`/app/atendimentos/${a.id}`} className={cx("block rounded-xl border-l-4 bg-card px-2.5 py-2 text-xs shadow-soft hover:bg-surface", toneBorder[statusTone[a.status]])}>
                      <p className="flex items-center justify-between gap-1 font-semibold text-primary">
                        {time(a.startsAt, tz)}
                        {(a.triage?.outcome as { priority?: string } | undefined)?.priority === "URGENTE" && <span className="rounded-full bg-danger-bg px-1.5 text-[10px] font-bold text-danger">URGENTE</span>}
                        {(a.triage?.outcome as { priority?: string } | undefined)?.priority === "ALTA" && <span className="rounded-full bg-warning-bg px-1.5 text-[10px] font-bold text-warning">ALTA</span>}
                      </p>
                      <p className="truncate font-medium text-ink">{a.client.name}</p>
                      <p className="truncate text-muted">{a.service.name}</p>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : appts.length === 0 ? (
        <EmptyState title="Semana tranquila" text="Nenhum atendimento nesta semana." />
      ) : (
        <div className="space-y-6">
          {days.filter((d) => byDay.has(key(d))).map((d) => (
            <section key={key(d)}>
              <h2 className="mb-2 font-sans text-sm font-semibold capitalize text-muted">{fmt(d, "EEEE, d 'de' MMMM", tz)}</h2>
              <div className="space-y-2">
                {byDay.get(key(d))!.map((a) => <AppointmentRow key={a.id} a={a} tz={tz} href={`/app/atendimentos/${a.id}`} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
