import { Avatar, Badge, Button, Card, Input, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { viewAs, viewAsProfession, viewAsTeam, viewAsVisitor } from "../actions";

export const metadata = { title: "Ver como" };

const statusInfo = {
  DRAFT: { label: "Rascunho", tone: "neutral" },
  REVIEW: { label: "Em validação", tone: "warning" },
  PUBLISHED: { label: "Publicado", tone: "success" },
} as const;

function ActionButton({ action, fields, label, variant = "secondary" }: { action: (f: FormData) => Promise<void>; fields: Record<string, string>; label: string; variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <form action={action}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <Button variant={variant} className="min-h-10 px-4">{label}</Button>
    </form>
  );
}

export default async function VerComo({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const match = q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] } : {};
  const [profiles, pros, clients] = await Promise.all([
    db.professionProfile.findMany({
      orderBy: { name: "asc" },
      include: { theme: { select: { id: true, updatedAt: true } }, professionals: { where: { user: { isSandbox: false } }, select: { id: true } } },
    }),
    db.user.findMany({
      where: { role: "PROFESSIONAL", isSandbox: false, professional: { isNot: null }, ...match },
      include: { professional: { include: { profile: true, _count: { select: { appointments: true } } } } },
      orderBy: { name: "asc" },
      take: 60,
    }),
    db.user.findMany({
      where: { role: "CLIENT", ...match },
      include: { clients: { include: { org: true, _count: { select: { appointments: true } } } } },
      orderBy: { name: "asc" },
      take: 60,
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Ver como"
        subtitle="Veja a plataforma exatamente como cada tipo de conta e cada profissão vê. Um selo no canto mostra quem você está vendo e leva de volta ao admin. Tudo fica no log de auditoria."
      />

      <section className="mb-10">
        <h2 className="mb-3 text-xl font-semibold">Tipos de conta</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card className="flex flex-col gap-3">
            <div><p className="font-semibold">Visitante</p><p className="text-sm text-muted">Sem login: vitrine, páginas públicas e agendamento com pré-cadastro.</p></div>
            <div className="mt-auto"><ActionButton action={viewAsVisitor} fields={{}} label="Ver como visitante" /></div>
          </Card>
          <Card className="flex flex-col gap-3">
            <div><p className="font-semibold">Cliente</p><p className="text-sm text-muted">Portal com agendamentos, remarcação, avaliações e dados (LGPD).</p></div>
            <a href="#clientes" className="mt-auto text-sm font-semibold text-primary">Escolher cliente ↓</a>
          </Card>
          <Card className="flex flex-col gap-3">
            <div><p className="font-semibold">Profissional</p><p className="text-sm text-muted">Área completa, com o tema da profissão. Escolha por profissão ou por pessoa.</p></div>
            <a href="#profissoes" className="mt-auto text-sm font-semibold text-primary">Escolher profissão ↓</a>
          </Card>
          <Card className="flex flex-col gap-3">
            <div><p className="font-semibold">Equipe: recepção e financeiro</p><p className="text-sm text-muted">Mesma área, com as restrições do papel (ex.: recepção não vê registros sigilosos).</p></div>
            <a href="#profissionais" className="mt-auto text-sm font-semibold text-primary">Escolher profissional ↓</a>
          </Card>
        </div>
      </section>

      <section id="profissoes" className="mb-10 scroll-mt-6">
        <h2 className="mb-1 text-xl font-semibold">Por profissão</h2>
        <p className="mb-3 text-sm text-muted">Abre uma conta de prévia da profissão, com clientes e agenda de exemplo. Funciona mesmo sem profissional cadastrado e com perfis em rascunho. A prévia não aparece para o público.</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {profiles.map((p) => (
            <Card key={p.id} role="group" aria-label={`Profissão ${p.name}`} className="flex flex-col gap-3 overflow-hidden p-0!">
              {p.theme ? (
                // eslint-disable-next-line @next/next/no-img-element -- miniatura servida pela API de temas
                <img src={`/api/temas/${p.theme.id}?v=${p.theme.updatedAt.getTime()}`} alt="" className="aspect-[16/6] w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex aspect-[16/6] items-center justify-center bg-surface text-xs text-muted">Sem tema</div>
              )}
              <div className="flex flex-1 flex-col gap-3 px-4 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{p.name}</p>
                  <Badge tone={statusInfo[p.status].tone}>{statusInfo[p.status].label}</Badge>
                </div>
                <p className="text-xs text-muted">{p.professionals.length} profissional(is) real(is)</p>
                <div className="mt-auto"><ActionButton action={viewAsProfession} fields={{ profileId: p.id }} label={`Ver como ${p.name}`} variant="primary" /></div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <form className="mb-6 flex gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder="Buscar pessoa por nome ou e-mail" aria-label="Buscar usuário" />
        <button className="min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-on-primary">Buscar</button>
      </form>

      <div className="grid gap-8 xl:grid-cols-2">
        <section id="profissionais" className="scroll-mt-6">
          <h2 className="mb-3 text-xl font-semibold">Profissionais <span className="text-base font-normal text-muted">({pros.length})</span></h2>
          <div className="grid gap-3">
            {pros.map((u) => (
              <Card key={u.id} role="group" aria-label={u.professional!.displayName} className="flex flex-wrap items-center gap-3 p-4">
                <Avatar name={u.name} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{u.professional!.displayName}</p>
                  <p className="truncate text-sm text-muted">{u.professional!.profile.name} · {u.email}</p>
                  <p className="text-xs text-muted">{u.professional!._count.appointments} atendimentos</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ActionButton action={viewAs} fields={{ userId: u.id }} label="Ver como" />
                  <ActionButton action={viewAsTeam} fields={{ professionalId: u.professional!.id, role: "RECEPTION" }} label="Recepção" variant="ghost" />
                  <ActionButton action={viewAsTeam} fields={{ professionalId: u.professional!.id, role: "FINANCE" }} label="Financeiro" variant="ghost" />
                </div>
              </Card>
            ))}
          </div>
        </section>
        <section id="clientes" className="scroll-mt-6">
          <h2 className="mb-3 text-xl font-semibold">Clientes com portal <span className="text-base font-normal text-muted">({clients.length})</span></h2>
          <div className="grid gap-3">
            {clients.map((u) => (
              <Card key={u.id} role="group" aria-label={`${u.name} (${u.email})`} className="flex items-center gap-3 p-4">
                <Avatar name={u.name} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{u.name}</p>
                  <p className="truncate text-sm text-muted">{u.email}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {u.clients.map((c) => <Badge key={c.id}>{c.org.name} · {c._count.appointments}</Badge>)}
                  </div>
                </div>
                <ActionButton action={viewAs} fields={{ userId: u.id }} label="Ver como" />
              </Card>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
