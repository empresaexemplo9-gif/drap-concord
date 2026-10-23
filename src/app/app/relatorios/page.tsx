import { addDays } from "date-fns";
import { Card, PageHeader } from "@/components/ui";
import { requireProfessional } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/format";

export const metadata = { title: "Relatórios" };

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm"><span>{label}</span><span className="font-semibold">{value}</span></div>
      <div className="h-2.5 rounded-full bg-surface"><div className="h-2.5 rounded-full bg-primary" style={{ width: `${max ? (value / max) * 100 : 0}%` }} /></div>
    </div>
  );
}

export default async function Relatorios({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { professional, orgId } = await requireProfessional();
  const days = [30, 90, 365].includes(Number((await searchParams).dias)) ? Number((await searchParams).dias) : 30;
  const since = addDays(new Date(), -days);
  const appts = await db.appointment.findMany({
    where: { orgId, professionalId: professional.id, startsAt: { gte: since, lte: new Date() } },
    include: { service: true },
  });
  const by = (s: string) => appts.filter((a) => a.status === s).length;
  const done = by("DONE"), noShow = by("NO_SHOW");
  const canceled = by("CANCELED_BY_CLIENT") + by("CANCELED_BY_PROFESSIONAL");
  const revenue = appts.filter((a) => a.status === "DONE").reduce((s, a) => s + a.service.priceCents, 0);
  const noShowRate = done + noShow ? Math.round((noShow / (done + noShow)) * 100) : 0;

  const avail = await db.availability.findMany({ where: { professionalId: professional.id } });
  const weeklyMin = avail.reduce((s, a) => s + (a.endMin - a.startMin), 0);
  const bookedMin = appts.filter((a) => a.status === "DONE" || a.status === "NO_SHOW").reduce((s, a) => s + a.service.durationMin, 0);
  const occupancy = weeklyMin ? Math.min(100, Math.round((bookedMin / ((weeklyMin * days) / 7)) * 100)) : 0;

  const clients = await db.client.findMany({ where: { orgId }, include: { appointments: { where: { status: "DONE" }, select: { id: true } } } });
  const returning = clients.filter((c) => c.appointments.length >= 2).length;
  const withAny = clients.filter((c) => c.appointments.length >= 1).length;
  const retention = withAny ? Math.round((returning / withAny) * 100) : 0;
  const portal = clients.filter((c) => c.userId).length;

  const perService = new Map<string, number>();
  for (const a of appts.filter((a) => a.status === "DONE")) perService.set(a.service.name, (perService.get(a.service.name) ?? 0) + 1);
  const maxService = Math.max(0, ...perService.values());

  return (
    <>
      <PageHeader title="Relatórios" subtitle={`Últimos ${days} dias`} action={
        <nav className="flex gap-1 rounded-xl border border-line bg-card p-1 text-sm">
          {[30, 90, 365].map((d) => <a key={d} href={`?dias=${d}`} className={`rounded-lg px-3 py-1.5 font-medium ${d === days ? "bg-primary text-on-primary" : "text-muted"}`}>{d === 365 ? "1 ano" : `${d} dias`}</a>)}
        </nav>
      } />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><p className="text-sm text-muted">Receita realizada</p><p className="mt-1 font-serif text-2xl font-semibold">{revenue ? money(revenue) : "R$ 0,00"}</p></Card>
        <Card><p className="text-sm text-muted">Taxa de faltas</p><p className="mt-1 font-serif text-3xl font-semibold">{noShowRate}%</p></Card>
        <Card><p className="text-sm text-muted">Ocupação da agenda</p><p className="mt-1 font-serif text-3xl font-semibold">{occupancy}%</p></Card>
        <Card><p className="text-sm text-muted">Retenção (2+ atendimentos)</p><p className="mt-1 font-serif text-3xl font-semibold">{retention}%</p></Card>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">Atendimentos</h2>
          <Bar label="Realizados" value={done} max={appts.length} />
          <Bar label="Faltas" value={noShow} max={appts.length} />
          <Bar label="Cancelados" value={canceled} max={appts.length} />
        </Card>
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">Por serviço</h2>
          {perService.size === 0 ? <p className="text-sm text-muted">Sem atendimentos realizados no período.</p> : [...perService].map(([k, v]) => <Bar key={k} label={k} value={v} max={maxService} />)}
        </Card>
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">Origem dos clientes</h2>
          <Bar label="Pela página pública / portal" value={portal} max={clients.length} />
          <Bar label="Cadastrados por você" value={clients.length - portal} max={clients.length} />
        </Card>
      </div>
    </>
  );
}
