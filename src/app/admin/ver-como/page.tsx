import { Avatar, Badge, Button, Card, Input, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { viewAs } from "../actions";

export const metadata = { title: "Ver como" };

function ViewAsButton({ userId, label }: { userId: string; label: string }) {
  return (
    <form action={viewAs}>
      <input type="hidden" name="userId" value={userId} />
      <Button variant="secondary" className="min-h-10 px-4">{label}</Button>
    </form>
  );
}

export default async function VerComo({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const match = q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] } : {};
  const [pros, clients] = await Promise.all([
    db.user.findMany({
      where: { role: "PROFESSIONAL", professional: { isNot: null }, ...match },
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
        subtitle="Entre na plataforma exatamente como um profissional ou cliente vê. Uma faixa no topo mostra quem você está vendo e leva de volta ao admin. Tudo fica no log de auditoria."
      />
      <form className="mb-6 flex gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder="Buscar por nome ou e-mail" aria-label="Buscar usuário" />
        <button className="min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-on-primary">Buscar</button>
      </form>
      <div className="grid gap-8 xl:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xl font-semibold">Profissionais <span className="text-base font-normal text-muted">({pros.length})</span></h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {pros.map((u) => (
              <Card key={u.id} role="group" aria-label={u.professional!.displayName} className="flex items-center gap-3 p-4">
                <Avatar name={u.name} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{u.professional!.displayName}</p>
                  <p className="truncate text-sm text-muted">{u.professional!.profile.name} · {u.email}</p>
                  <p className="text-xs text-muted">{u.professional!._count.appointments} atendimentos</p>
                </div>
                <ViewAsButton userId={u.id} label="Ver como" />
              </Card>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-xl font-semibold">Clientes com portal <span className="text-base font-normal text-muted">({clients.length})</span></h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
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
                <ViewAsButton userId={u.id} label="Ver como" />
              </Card>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
