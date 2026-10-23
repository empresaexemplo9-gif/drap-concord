import Link from "next/link";
import { Avatar, Badge, ButtonLink, EmptyState, Input, PageHeader } from "@/components/ui";
import { requireProfessional } from "@/lib/auth";
import { db } from "@/lib/db";
import { professionalConfig } from "@/lib/profiles/registry";
import { stageLabel } from "@/lib/format";

export const metadata = { title: "Clientes" };

const stageTone = { LEAD: "warning", FIRST_VISIT: "info", ACTIVE: "success", INACTIVE: "neutral" } as const;

export default async function Clientes({ searchParams }: { searchParams: Promise<{ q?: string; etapa?: string; tag?: string }> }) {
  const { professional, orgId } = await requireProfessional();
  const { q, etapa, tag } = await searchParams;
  const cfg = await professionalConfig(professional);
  const t = cfg.terminology.client;
  const clients = await db.client.findMany({
    where: {
      orgId,
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {}),
      ...(etapa ? { stage: etapa as "LEAD" } : {}),
      ...(tag ? { tags: { has: tag } } : {}),
    },
    orderBy: { name: "asc" },
    include: { appointments: { orderBy: { startsAt: "desc" }, take: 1, select: { startsAt: true } } },
  });
  const counts = await db.client.groupBy({ by: ["stage"], where: { orgId }, _count: true });
  const title = t.plural[0].toUpperCase() + t.plural.slice(1);

  return (
    <>
      <PageHeader title={title} subtitle="Cadastro, histórico e funil" action={<ButtonLink href="/app/clientes/novo">+ Novo(a) {t.singular}</ButtonLink>} />
      <form className="mb-4 flex gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder="Buscar por nome, e-mail ou telefone" aria-label="Buscar" />
        {etapa && <input type="hidden" name="etapa" value={etapa} />}
        <button className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary">Buscar</button>
      </form>
      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        <Link href="/app/clientes" className={`rounded-full border px-3 py-1.5 ${!etapa ? "border-primary bg-primary text-on-primary" : "border-line bg-card"}`}>Todos</Link>
        {Object.entries(stageLabel).map(([k, v]) => (
          <Link key={k} href={`/app/clientes?etapa=${k}`} className={`rounded-full border px-3 py-1.5 ${etapa === k ? "border-primary bg-primary text-on-primary" : "border-line bg-card"}`}>
            {v} <span className="opacity-70">{counts.find((c) => c.stage === k)?._count ?? 0}</span>
          </Link>
        ))}
      </div>
      {clients.length === 0 ? (
        <EmptyState title={`Nenhum(a) ${t.singular} por aqui`} text="Cadastre manualmente ou compartilhe sua página pública para receber agendamentos." action={<ButtonLink href="/app/clientes/novo" variant="secondary">Cadastrar</ButtonLink>} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          {clients.map((c) => (
            <li key={c.id}>
              <Link href={`/app/clientes/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface">
                <Avatar name={c.name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="truncate text-sm text-muted">{c.email ?? c.phone ?? "Sem contato"}{c.tags.length > 0 && ` · ${c.tags.join(", ")}`}</p>
                </div>
                <Badge tone={stageTone[c.stage]}>{stageLabel[c.stage]}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
