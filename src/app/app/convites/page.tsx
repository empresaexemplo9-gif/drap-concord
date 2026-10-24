import Link from "next/link";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { InviteShare } from "@/components/invite-share";
import { requireProfessional } from "@/lib/auth";
import { db } from "@/lib/db";
import { generalInvite, inviteStatus } from "@/lib/invites";
import { professionalConfig } from "@/lib/profiles/registry";
import { fmt } from "@/lib/format";
import { regenerateGeneral, revokeInvite } from "./actions";

export const metadata = { title: "Convidar clientes" };

const tone = { ativo: "success", usado: "info", expirado: "warning", revogado: "neutral" } as const;

export default async function Convites() {
  const { professional, user, orgId } = await requireProfessional();
  const cfg = await professionalConfig(professional);
  const plural = cfg.terminology.client.plural.toLowerCase();
  const general = await generalInvite(professional, user.id);
  const [invites, joined] = await Promise.all([
    db.invite.findMany({ where: { orgId, professionalId: professional.id }, include: { client: { select: { id: true, name: true, userId: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.client.count({ where: { orgId, userId: { not: null } } }),
  ]);

  return (
    <>
      <PageHeader
        title="Convidar clientes"
        subtitle={`Envie um link para seus ${plural} criarem a própria conta (Acesso 2). Com ela, eles agendam, confirmam e remarcam com você, e também podem buscar outros serviços na plataforma.`}
      />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Card>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Seu link de convite</h2>
              <Badge tone="success">{general.uses} conta(s) criada(s)</Badge>
            </div>
            <p className="mb-4 text-sm text-muted">Use em grupos, redes sociais, na bio ou na recepção. Quem entrar por ele aparece na sua lista de {plural}, já com conta própria.</p>
            <InviteShare token={general.token} professionalName={professional.displayName} />
            <form action={regenerateGeneral} className="mt-4">
              <Button variant="ghost" className="px-0 text-sm">Gerar novo link (o atual deixa de funcionar)</Button>
            </form>
          </Card>
          <Card>
            <h2 className="mb-1 text-lg font-semibold">Convite pessoal</h2>
            <p className="text-sm text-muted">
              Para quem já está na sua lista: abra a ficha em <Link href="/app/clientes" className="font-semibold text-primary">{cfg.terminology.client.plural}</Link> e use “Enviar convite de acesso”. A conta criada assume a ficha, com o histórico. Vale para uma pessoa e expira em 30 dias.
            </p>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <p className="text-xs text-muted first-letter:uppercase">{plural} com conta própria</p>
            <p className="font-serif text-3xl font-semibold">{joined}</p>
          </Card>
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Convites enviados</h2>
            {invites.length === 0 ? <EmptyState title="Nenhum convite ainda" text="Os convites aparecem aqui." /> : (
              <ul className="divide-y divide-line">
                {invites.map((i) => {
                  const st = inviteStatus(i);
                  return (
                    <li key={i.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">
                          {i.kind === "GENERAL" ? "Link geral" : i.client ? <Link href={`/app/clientes/${i.client.id}`} className="hover:text-primary">{i.client.name}</Link> : i.label}
                        </p>
                        <p className="text-xs text-muted">{fmt(i.createdAt, "dd/MM/yyyy", professional.timezone)} · {i.uses} uso(s){i.expiresAt ? ` · expira ${fmt(i.expiresAt, "dd/MM", professional.timezone)}` : ""}</p>
                      </div>
                      <Badge tone={tone[st]}>{st}</Badge>
                      {st === "ativo" && (
                        <form action={revokeInvite}>
                          <input type="hidden" name="id" value={i.id} />
                          <button className="min-h-11 px-2 text-xs font-semibold text-danger">Desativar</button>
                        </form>
                      )}
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
