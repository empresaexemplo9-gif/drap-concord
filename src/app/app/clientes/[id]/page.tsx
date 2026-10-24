import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, Badge, ButtonLink, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { requireProfessional } from "@/lib/auth";
import { db } from "@/lib/db";
import { tenant } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { canSeeRecords, professionalConfig } from "@/lib/profiles/registry";
import { dateShort, fmt, stageLabel, statusLabel, statusTone } from "@/lib/format";
import { updateClient } from "../../actions";
import { invitePersonal } from "../../convites/actions";
import { InviteShare } from "@/components/invite-share";
import { inviteStatus } from "@/lib/invites";


export const metadata = { title: "Ficha" };

export default async function Cliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { professional, orgId, memberRole, user } = await requireProfessional();
  const client = await tenant(orgId).clients.get(id);
  if (!client) notFound();
  const cfg = await professionalConfig(professional);
  const tz = professional.timezone;
  const showRecords = canSeeRecords(memberRole, cfg);
  const triages = showRecords ? await db.triageResponse.findMany({ where: { orgId, clientId: id }, orderBy: { createdAt: "desc" } }) : [];
  const [appts, records, events] = await Promise.all([
    tenant(orgId).appointments.list({ clientId: id }),
    showRecords ? tenant(orgId).records.forClient(id) : Promise.resolve([]),
    db.ruleEvent.findMany({ where: { clientId: id, rule: { orgId } }, include: { rule: true }, orderBy: { createdAt: "desc" } }),
  ]);
  if (records.length) await audit({ orgId, userId: user.id, action: "record.viewed", entity: "Client", entityId: id });
  const personal = client.userId ? null : await db.invite.findFirst({ where: { orgId, clientId: id, kind: "PERSONAL", revokedAt: null }, orderBy: { createdAt: "desc" } });
  const activeInvite = personal && inviteStatus(personal) === "ativo" ? personal : null;
  const fields = cfg.recordTemplate.sections.flatMap((s) => s.fields);

  type Item = { at: Date; kind: string; node: React.ReactNode };
  const timeline: Item[] = [
    ...appts.map((a) => ({
      at: a.startsAt,
      kind: "appt",
      node: (
        <Link href={`/app/atendimentos/${a.id}`} className="flex items-center justify-between gap-3 hover:text-primary">
          <span><strong>{a.service.name}</strong> <span className="text-muted">· {fmt(a.startsAt, "dd/MM/yyyy HH:mm", tz)}</span></span>
          <Badge tone={statusTone[a.status]}>{statusLabel[a.status]}</Badge>
        </Link>
      ),
    })),
    ...records.map((r) => ({
      at: r.createdAt,
      kind: "record",
      node: (
        <div>
          <p className="font-semibold">{cfg.terminology.record} <span className="font-normal text-muted">· {fmt(r.createdAt, "dd/MM/yyyy", tz)}</span></p>
          <p className="mt-1 line-clamp-3 text-sm text-muted">
            {fields.map((f) => (r.data as Record<string, unknown>)[f.key]).filter(Boolean).map((v) => (Array.isArray(v) ? v.join(", ") : String(v))).join(" · ")}
          </p>
        </div>
      ),
    })),
    ...triages.map((t) => {
      const o = t.outcome as { priority: string; recommendations: string[] };
      return {
        at: t.createdAt,
        kind: "triage",
        node: (
          <div className="text-sm">
            <p><Badge tone={o.priority === "URGENTE" ? "danger" : o.priority === "ALTA" ? "warning" : "info"}>Triagem</Badge> <strong className="ml-1">{t.careTypeName}</strong> <span className="text-muted">· {fmt(t.createdAt, "dd/MM/yyyy", tz)}</span></p>
            {o.recommendations.length > 0 && <p className="mt-1 text-muted">{o.recommendations.join(" · ")}</p>}
            {t.appointmentId && <Link href={`/app/atendimentos/${t.appointmentId}`} className="text-xs font-semibold text-primary">Ver respostas no atendimento →</Link>}
          </div>
        ),
      };
    }),
    ...events.map((e) => ({
      at: e.createdAt,
      kind: "rule",
      node: <p className="text-sm"><Badge tone="info">Regra</Badge> <span className="ml-1">{e.summary}</span></p>,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const doneCount = appts.filter((a) => a.status === "DONE").length;
  const noShows = appts.filter((a) => a.status === "NO_SHOW").length;
  const intake = Object.entries(client.intake as Record<string, unknown>);

  return (
    <>
      <Link href="/app/clientes" className="mb-3 inline-block text-sm font-semibold text-primary">← {cfg.terminology.client.plural}</Link>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Avatar name={client.name} size={64} />
        <div className="flex-1">
          <h1 className="text-2xl font-semibold sm:text-3xl">{client.name}</h1>
          <p className="text-sm text-muted">
            {client.email ?? "Sem e-mail"} · {client.phone ?? "Sem telefone"}
            {client.birthDate && ` · Nasc. ${dateShort(client.birthDate)}`}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="info">{stageLabel[client.stage]}</Badge>
            {client.tags.map((t) => <Badge key={t} tone={t === "bloqueado" ? "danger" : "neutral"}>{t}</Badge>)}
            {client.userId && <Badge tone="success">Usa o portal</Badge>}
          </div>
        </div>
        <ButtonLink href={`/app/agendar?cliente=${client.id}`}>Agendar</ButtonLink>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <Card><p className="text-xs text-muted">Realizados</p><p className="font-serif text-2xl font-semibold">{doneCount}</p></Card>
            <Card><p className="text-xs text-muted">Faltas</p><p className="font-serif text-2xl font-semibold">{noShows}</p></Card>
            <Card><p className="text-xs text-muted">Total</p><p className="font-serif text-2xl font-semibold">{appts.length}</p></Card>
          </div>
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Linha do tempo</h2>
            {timeline.length === 0 ? <p className="text-sm text-muted">Ainda não há histórico.</p> : (
              <ol className="relative space-y-4 border-l border-line pl-5">
                {timeline.map((i, n) => (
                  <li key={n} className="relative">
                    <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full bg-accent" aria-hidden />
                    {i.node}
                  </li>
                ))}
              </ol>
            )}
            {!showRecords && <p className="mt-4 text-xs text-muted">Registros de atendimento ocultos para o seu papel.</p>}
          </Card>
        </div>

        <div className="space-y-6">
          {!client.userId && (
            <Card id="convite" className="scroll-mt-6">
              <h2 className="mb-1 text-lg font-semibold">Acesso do {cfg.terminology.client.singular.toLowerCase()}</h2>
              <p className="mb-4 text-sm text-muted">{client.name.split(" ")[0]} ainda não tem conta. Envie um convite: a conta criada (Acesso 2) fica ligada a esta ficha e ao histórico.</p>
              {activeInvite ? (
                <>
                  <InviteShare token={activeInvite.token} professionalName={professional.displayName} clientName={client.name} />
                  <p className="mt-2 text-xs text-muted">Vale para uma pessoa e expira em {fmt(activeInvite.expiresAt!, "dd/MM/yyyy", tz)}.</p>
                </>
              ) : (
                <form action={invitePersonal}>
                  <input type="hidden" name="clientId" value={client.id} />
                  <SubmitButton pendingText="Gerando…">Enviar convite de acesso</SubmitButton>
                </form>
              )}
            </Card>
          )}
          {intake.length > 0 && (
            <Card>
              <h2 className="mb-3 text-lg font-semibold">Formulário prévio</h2>
              <dl className="space-y-2 text-sm">
                {intake.map(([k, v]) => {
                  const label = cfg.intakeForm?.sections.flatMap((s) => s.fields).find((f) => f.key === k)?.label ?? k;
                  return <div key={k}><dt className="font-semibold">{label}</dt><dd className="text-muted">{Array.isArray(v) ? v.join(", ") : String(v)}</dd></div>;
                })}
              </dl>
            </Card>
          )}
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Dados e notas</h2>
            <form action={updateClient} className="space-y-3">
              <input type="hidden" name="id" value={client.id} />
              <Field label="E-mail" htmlFor="email"><Input id="email" name="email" type="email" defaultValue={client.email ?? ""} /></Field>
              <Field label="Telefone" htmlFor="phone"><Input id="phone" name="phone" defaultValue={client.phone ?? ""} /></Field>
              <Field label="Etapa" htmlFor="stage">
                <Select id="stage" name="stage" defaultValue={client.stage}>
                  {Object.entries(stageLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </Field>
              <Field label="Tags" htmlFor="tags" hint="Separe por vírgula. A tag “bloqueado” impede novos agendamentos pelo cliente."><Input id="tags" name="tags" defaultValue={client.tags.join(", ")} /></Field>
              <Field label="Notas privadas" htmlFor="notes" hint="Só você vê."><Textarea id="notes" name="notes" defaultValue={client.notes ?? ""} /></Field>
              <SubmitButton>Salvar</SubmitButton>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
