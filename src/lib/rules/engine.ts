import { SENSITIVE_ACTIONS, type RuleAction } from "@/lib/profiles/schema";

// Motor de regras: gatilho + condições -> ações.
// Funções puras; quem persiste e executa é src/lib/rules/run.ts.

export type RuleLike = {
  id: string;
  key: string;
  name: string;
  trigger: string;
  conditions: { consecutiveGte?: number; days?: number };
  actions: RuleAction[];
  mode: "SUGGEST" | "AUTO";
  enabled: boolean;
};

export type HistoryItem = {
  startsAt: Date;
  status: string;
};

export type PlannedAction = {
  action: RuleAction;
  message: string;
  // Ação sensível em modo "sugerir": aguarda a confirmação do profissional.
  requiresApproval: boolean;
};

export type RuleOutcome = {
  rule: RuleLike;
  vars: Record<string, string | number>;
  actions: PlannedAction[];
};

export function render(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : `{{${k}}}`));
}

export function isSensitive(action: RuleAction) {
  return (SENSITIVE_ACTIONS as readonly string[]).includes(action.type);
}

/** Faltas seguidas, contando do atendimento passado mais recente para trás. */
export function consecutiveNoShows(history: HistoryItem[], now: Date) {
  const past = history
    .filter((h) => h.startsAt <= now && (h.status === "NO_SHOW" || h.status === "DONE"))
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  let count = 0;
  for (const h of past) {
    if (h.status !== "NO_SHOW") break;
    count++;
  }
  return count;
}

function plan(rule: RuleLike, vars: Record<string, string | number>): RuleOutcome {
  return {
    rule,
    vars,
    actions: rule.actions.map((action) => ({
      action,
      message: render(action.message, vars),
      requiresApproval: rule.mode === "SUGGEST" && isSensitive(action),
    })),
  };
}

/**
 * Avalia as regras de falta. Cada regra dispara uma única vez por sequência:
 * quando a contagem atinge exatamente o limite configurado.
 */
export function evaluateNoShow(
  rules: RuleLike[],
  history: HistoryItem[],
  ctx: { clientName: string; now: Date },
): RuleOutcome[] {
  const count = consecutiveNoShows(history, ctx.now);
  return rules
    .filter((r) => r.enabled && r.trigger === "NO_SHOW" && r.conditions.consecutiveGte === count)
    .map((rule) => {
      const cancel = rule.actions.find((a) => a.type === "CANCEL_FUTURE");
      return plan(rule, {
        count,
        client: ctx.clientName,
        graceDays: cancel && cancel.type === "CANCEL_FUTURE" ? cancel.graceDays : 0,
      });
    });
}

/** Clientes sem atendimento realizado há exatamente N dias (gatilho diário). */
export function evaluateDaysWithoutReturn(
  rules: RuleLike[],
  lastDoneAt: Date | null,
  hasFuture: boolean,
  ctx: { clientName: string; now: Date },
): RuleOutcome[] {
  if (!lastDoneAt || hasFuture) return [];
  const days = Math.floor((ctx.now.getTime() - lastDoneAt.getTime()) / 86_400_000);
  return rules
    .filter((r) => r.enabled && r.trigger === "DAYS_WITHOUT_RETURN" && r.conditions.days === days)
    .map((rule) => plan(rule, { days, client: ctx.clientName }));
}
