import Link from "next/link";
import { Alert, Badge, Button, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateLong, fmt, modalityLabel, statusLabel, statusTone, time } from "@/lib/format";
import { cancel, confirm, markRead } from "./actions";

export const metadata = { title: "Meus agendamentos" };

const okMsg: Record<string, string> = {
  cancelado: "Cancelado. O profissional foi avisado.",
  remarcado: "Remarcado! O profissional foi avisado.",
  avaliado: "Obrigado pela avaliação! Ela aparece após moderação.",
};

export default async function MinhaConta({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; bemvindo?: string; convite?: string }> }) {
  const user = await requireUser(["CLIENT"]);
  const { ok, erro, bemvindo, convite } = await searchParams;
  const mine = await db.client.findMany({ where: { userId: user.id }, include: { org: { include: { professionals: { where: { isPublic: true }, select: { displayName: true, slug: true }, take: 1 } } } } });
  const pros = mine.flatMap((c) => c.org.professionals);
  const appts = await db.appointment.findMany({
    where: { client: { userId: user.id }, status: { not: "RESCHEDULED" } },
    include: { service: true, professional: true, client: { include: { reviews: { select: { id: true } } } } },
    orderBy: { startsAt: "asc" },
  });
  const now = new Date();
  const upcoming = appts.filter((a) => a.startsAt >= now && (a.status === "PENDING" || a.status === "CONFIRMED"));
  const past = appts.filter((a) => !upcoming.includes(a)).reverse();
  const notifications = await db.notification.findMany({ where: { userId: user.id, readAt: null }, orderBy: { createdAt: "desc" }, take: 5 });

  return (
    <>
      <PageHeader title={`Olá, ${user.name.split(" ")[0]}`} subtitle="Seus agendamentos em um só lugar." action={<ButtonLink href="/" variant="secondary">Agendar novo</ButtonLink>} />
      {bemvindo && (
        <div className="mb-4">
          <Alert tone={convite ? "warning" : "success"}>
            {convite ? "Conta criada, mas o convite não estava mais válido. Você já pode buscar e agendar serviços." : `Bem-vindo(a)! Sua conta (Acesso 2) está pronta${pros.length ? `, ligada a ${pros.map((p) => p.displayName).join(", ")}` : ""}.`}
          </Alert>
        </div>
      )}
      {ok && okMsg[ok] && <div className="mb-4"><Alert tone="success">{okMsg[ok]}</Alert></div>}
      {erro && <div className="mb-4"><Alert tone="danger">{erro}</Alert></div>}

      {notifications.length > 0 && (
        <Card className="mb-6 border-accent/40">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Novidades</h2>
            <form action={markRead}><button className="min-h-11 text-sm font-semibold text-primary">Marcar como lidas</button></form>
          </div>
          <ul className="space-y-2 text-sm">
            {notifications.map((n) => (
              <li key={n.id}><Link href={n.link ?? "#"} className="block hover:text-primary"><strong>{n.title}.</strong> {n.body}</Link></li>
            ))}
          </ul>
        </Card>
      )}

      <h2 className="mb-3 text-xl font-semibold">Próximos</h2>
      {upcoming.length === 0 ? (
        <EmptyState title="Nada marcado por enquanto" text="Quando você agendar, seus horários aparecem aqui com lembretes." action={<ButtonLink href="/">Encontrar profissional</ButtonLink>} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {upcoming.map((a) => {
            const tz = a.professional.timezone;
            return (
              <Card key={a.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-serif text-lg font-semibold capitalize">{dateLong(a.startsAt, tz)}, {time(a.startsAt, tz)}</p>
                    <p className="text-sm text-muted">{a.service.name} · {modalityLabel[a.modality]} · com <Link className="font-medium text-primary" href={`/p/${a.professional.slug}`}>{a.professional.displayName}</Link></p>
                  </div>
                  <Badge tone={statusTone[a.status]}>{statusLabel[a.status]}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {a.status === "PENDING" ? (
                    <form action={confirm}><input type="hidden" name="id" value={a.id} /><Button className="w-full">Confirmar</Button></form>
                  ) : <span className="inline-flex min-h-11 items-center justify-center rounded-xl bg-success-bg text-sm font-semibold text-success">✓ Confirmado</span>}
                  <ButtonLink href={`/minha-conta/remarcar/${a.id}`} variant="secondary">Reagendar</ButtonLink>
                  <form action={cancel}><input type="hidden" name="id" value={a.id} /><Button variant="danger" className="w-full">Cancelar</Button></form>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 text-xl font-semibold">Histórico</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card text-sm">
            {past.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1"><strong>{a.service.name}</strong> <span className="text-muted">· {a.professional.displayName} · {fmt(a.startsAt, "dd/MM/yyyy", a.professional.timezone)}</span></span>
                <Badge tone={statusTone[a.status]}>{statusLabel[a.status]}</Badge>
                {a.status === "DONE" && <Link href={`/minha-conta/avaliar/${a.id}`} className="font-semibold text-primary">Avaliar</Link>}
              </li>
            ))}
          </ul>
        </>
      )}
      <section className="mt-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Meus profissionais</h2>
          <Link href="/vitrine" className="text-sm font-semibold text-primary">Buscar outros serviços →</Link>
        </div>
        {pros.length === 0 ? <p className="text-sm text-muted">Você ainda não tem profissionais. Busque na vitrine ou peça o link de convite.</p> : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {pros.map((p) => (
              <Card key={p.slug} className="flex items-center justify-between gap-3 p-4">
                <span className="font-semibold">{p.displayName}</span>
                <ButtonLink href={`/p/${p.slug}/agendar`} variant="secondary">Agendar</ButtonLink>
              </Card>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
