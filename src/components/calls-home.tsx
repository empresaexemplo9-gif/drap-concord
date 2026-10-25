import Link from "next/link";
import { Alert, Badge, Card, EmptyState, Field, Input, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { NotificationPermission } from "@/components/call/notification-permission";
import { ContactPicker } from "@/components/call/contact-picker";
import type { CurrentUser } from "@/lib/auth";
import { contactsFor, myRooms } from "@/lib/calls";
import { fmt } from "@/lib/format";
import { startCall, redial } from "@/app/chamadas/actions";

const stateText: Record<string, string> = { JOINED: "na chamada", INVITED: "chamando", LEFT: "saiu", DECLINED: "recusou", MISSED: "não atendeu" };

/** Chamadas da conta: criar sala, salas ativas e histórico. Serve para profissionais e clientes. */
export async function CallsHome({ user, from, erro }: { user: CurrentUser; from: string; erro?: string }) {
  const [contacts, rooms] = await Promise.all([contactsFor(user), myRooms(user.id)]);
  const active = rooms.filter((r) => r.status === "ACTIVE" && r.view.some((p) => p.state === "JOINED"));
  const history = rooms.filter((r) => !active.includes(r));

  return (
    <>
      <PageHeader title="Chamadas" subtitle="Chamadas de áudio e vídeo dentro da plataforma, com quantas pessoas você quiser. Quem você chamar recebe a chamada tocando na própria conta." />
      {erro && <div className="mb-4"><Alert tone="danger">{erro}</Alert></div>}
      <NotificationPermission />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Nova chamada</h2>
          {contacts.length === 0 ? (
            <EmptyState title="Sem contatos ainda" text={user.role === "CLIENT" ? "Quando você agenda com um profissional ou aceita um convite, ele aparece aqui." : "Seus clientes com conta e sua equipe aparecem aqui. Convide clientes em Convidar clientes."} />
          ) : (
            <form action={startCall} className="space-y-4">
              <input type="hidden" name="from" value={from} />
              <ContactPicker contacts={contacts.map(({ id, name, label }) => ({ id, name, label }))} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome da sala (opcional)" htmlFor="title"><Input id="title" name="title" maxLength={120} placeholder="Ex.: Reunião de equipe" /></Field>
                <fieldset>
                  <legend className="mb-1.5 text-sm font-medium">Tipo</legend>
                  <div className="flex gap-2">
                    {[["VIDEO", "Vídeo"], ["AUDIO", "Só áudio"]].map(([v, l]) => (
                      <label key={v} className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line text-sm font-medium has-[:checked]:border-primary has-[:checked]:bg-surface">
                        <input type="radio" name="kind" value={v} defaultChecked={v === "VIDEO"} className="size-4 accent-[var(--primary)]" /> {l}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
              <SubmitButton className="w-full" pendingText="Chamando…">Chamar</SubmitButton>
            </form>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Acontecendo agora</h2>
            {active.length === 0 ? <p className="text-sm text-muted">Nenhuma chamada em andamento.</p> : (
              <ul className="space-y-3">
                {active.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{r.title}</p>
                      <p className="text-xs text-muted">{r.view.filter((p) => p.state === "JOINED").map((p) => p.name).join(", ")}</p>
                    </div>
                    <Link href={`/chamadas/${r.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-[#1f9d55] px-4 text-sm font-semibold text-white">Entrar</Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Histórico</h2>
            {history.length === 0 ? <p className="text-sm text-muted">Suas chamadas aparecem aqui.</p> : (
              <ul className="divide-y divide-line">
                {history.map((r) => {
                  const missed = r.ownerId !== user.id && !r.participants.find((p) => p.userId === user.id)?.joinedAt;
                  return (
                    <li key={r.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{r.kind === "VIDEO" ? "🎥" : "📞"} {r.title}</p>
                        <p className="text-xs text-muted">
                          {fmt(r.createdAt, "dd/MM 'às' HH:mm", "America/Sao_Paulo")} · {r.view.filter((p) => p.userId !== user.id).map((p) => `${p.name} (${stateText[p.state] ?? p.state})`).join(", ")}
                        </p>
                      </div>
                      {missed && <Badge tone="danger">Perdida</Badge>}
                      <form action={redial}>
                        <input type="hidden" name="roomId" value={r.id} />
                        <button className="min-h-11 rounded-xl px-3 font-semibold text-primary hover:bg-surface">Ligar de novo</button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
