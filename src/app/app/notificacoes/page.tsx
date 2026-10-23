import Link from "next/link";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { requireProfessional } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmt } from "@/lib/format";
import { markAllRead } from "../actions";

export const metadata = { title: "Notificações" };

export default async function Notificacoes() {
  const { user, professional } = await requireProfessional();
  const list = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });
  return (
    <>
      <PageHeader title="Notificações" action={list.some((n) => !n.readAt) && <form action={markAllRead}><Button variant="secondary">Marcar todas como lidas</Button></form>} />
      {list.length === 0 ? <EmptyState title="Tudo em dia" text="Avisos de novos agendamentos, confirmações e regras aparecem aqui." /> : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          {list.map((n) => (
            <li key={n.id}>
              <Link href={n.link ?? "#"} className="flex gap-3 px-4 py-3 hover:bg-surface">
                <span className={`mt-2 size-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-accent"}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{n.title}{!n.readAt && <span className="sr-only"> (não lida)</span>}</span>
                  <span className="block text-sm text-muted">{n.body}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">{fmt(n.createdAt, "dd/MM HH:mm", professional.timezone)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
