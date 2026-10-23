import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { requireProfessional } from "@/lib/auth";
import { db } from "@/lib/db";
import { tenant } from "@/lib/tenant";
import { fmt } from "@/lib/format";
import { isSensitive } from "@/lib/rules/engine";
import type { RuleAction } from "@/lib/profiles/schema";
import { decideRuleEvent, undoRuleEvent, updateRule } from "../actions";

export const metadata = { title: "Regras automáticas" };

const triggerLabel: Record<string, string> = {
  NO_SHOW: "Quando houver faltas seguidas",
  DAYS_WITHOUT_RETURN: "Quando o cliente ficar dias sem retorno",
  DEADLINE_APPROACHING: "Quando um prazo se aproximar",
  CANCELLATION: "Quando houver cancelamento",
  UNCONFIRMED: "Quando a confirmação não for respondida",
  PACKAGE_END: "Quando um pacote terminar",
  BIRTHDAY: "No aniversário",
  PAYMENT_OVERDUE: "Quando um pagamento vencer",
};
const actionLabel: Record<string, string> = {
  NOTIFY_CLIENT: "Avisar o cliente",
  NOTIFY_PROFESSIONAL: "Me avisar",
  CANCEL_FUTURE: "Cancelar atendimentos futuros",
  BLOCK_BOOKING: "Bloquear novos agendamentos",
  OPEN_TASK: "Abrir tarefa",
};
const evTone = { PENDING_APPROVAL: "warning", EXECUTED: "success", DISMISSED: "neutral", UNDONE: "neutral" } as const;
const evLabel = { PENDING_APPROVAL: "Aguardando você", EXECUTED: "Executada", DISMISSED: "Descartada", UNDONE: "Desfeita" };

export default async function Regras({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { professional, orgId } = await requireProfessional();
  const { ok } = await searchParams;
  const tz = professional.timezone;
  const rules = await tenant(orgId).rules.list(professional.id);
  const events = await db.ruleEvent.findMany({
    where: { rule: { orgId, professionalId: professional.id } },
    include: { client: true, rule: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const pending = events.filter((e) => e.status === "PENDING_APPROVAL");

  return (
    <>
      <PageHeader title="Regras automáticas" subtitle="Gatilho + condição → ação. Ações sensíveis começam pedindo sua confirmação." />
      {ok && <div className="mb-4"><Alert tone="success">Regra salva.</Alert></div>}

      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold">Aguardando sua decisão</h2>
          <div className="space-y-3">
            {pending.map((e) => (
              <Card key={e.id} className="border-accent/50">
                <p className="text-sm text-muted">{e.rule.name} · {fmt(e.createdAt, "dd/MM HH:mm", tz)}</p>
                <p className="mt-1 font-medium">{e.summary}</p>
                <div className="mt-3 flex gap-2">
                  <form action={decideRuleEvent}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="decision" value="approve" /><Button>Confirmar</Button></form>
                  <form action={decideRuleEvent}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="decision" value="dismiss" /><Button variant="secondary">Não fazer</Button></form>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-4">
        {rules.length === 0 && <p className="text-muted">Seu perfil não traz regras padrão.</p>}
        {rules.map((r) => {
          const actions = r.actions as RuleAction[];
          const cond = r.conditions as { consecutiveGte?: number; days?: number };
          const sensitive = actions.some(isSensitive);
          return (
            <Card key={r.id}>
              <form action={updateRule} className="space-y-4">
                <input type="hidden" name="id" value={r.id} />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">{r.name}</h3>
                    <p className="text-sm text-muted">{triggerLabel[r.trigger] ?? r.trigger}</p>
                  </div>
                  <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
                    <input type="checkbox" name="enabled" defaultChecked={r.enabled} className="size-5 accent-[var(--primary)]" /> Ativa
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {cond.consecutiveGte !== undefined && (
                    <Field label="Número de faltas seguidas" htmlFor={`c-${r.id}`}><Input id={`c-${r.id}`} name="consecutiveGte" type="number" min={1} defaultValue={cond.consecutiveGte} /></Field>
                  )}
                  {cond.days !== undefined && (
                    <Field label="Dias" htmlFor={`d-${r.id}`}><Input id={`d-${r.id}`} name="days" type="number" min={1} defaultValue={cond.days} /></Field>
                  )}
                  <Field label="Modo" htmlFor={`m-${r.id}`} hint={sensitive ? "Ação sensível: recomendamos “sugerir”." : undefined}>
                    <Select id={`m-${r.id}`} name="mode" defaultValue={r.mode}>
                      <option value="SUGGEST">Sugerir e pedir minha confirmação</option>
                      <option value="AUTO">Executar automaticamente</option>
                    </Select>
                  </Field>
                </div>
                {actions.map((a, i) => (
                  <div key={i} className="rounded-xl bg-surface p-3">
                    <p className="mb-2 flex items-center gap-2 text-sm font-semibold">{actionLabel[a.type]} {isSensitive(a) && <Badge tone="warning">sensível</Badge>}</p>
                    <Field label="Mensagem" htmlFor={`msg-${r.id}-${i}`} hint="Variáveis: {{client}}, {{count}}, {{days}}, {{graceDays}}">
                      <Textarea id={`msg-${r.id}-${i}`} name={`message_${i}`} defaultValue={a.message} className="min-h-16" />
                    </Field>
                    {a.type === "CANCEL_FUTURE" && (
                      <div className="mt-2"><Field label="Prazo de aviso antes de cancelar (dias)" htmlFor={`g-${r.id}-${i}`}><Input id={`g-${r.id}-${i}`} name={`grace_${i}`} type="number" min={0} defaultValue={a.graceDays} className="max-w-32" /></Field></div>
                    )}
                  </div>
                ))}
                <SubmitButton variant="secondary">Salvar regra</SubmitButton>
              </form>
            </Card>
          );
        })}
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-xl font-semibold">Histórico</h2>
        {events.length === 0 ? <p className="text-sm text-muted">Nenhuma ação automática ainda.</p> : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Badge tone={evTone[e.status]}>{evLabel[e.status]}</Badge>
                <span className="min-w-0 flex-1">{e.summary} <span className="text-muted">· {e.client.name} · {fmt(e.createdAt, "dd/MM HH:mm", tz)}</span></span>
                {e.status === "EXECUTED" && e.undoData && (
                  <form action={undoRuleEvent}><input type="hidden" name="id" value={e.id} /><Button variant="ghost" className="min-h-9 px-2">Desfazer</Button></form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
