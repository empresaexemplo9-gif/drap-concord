import { PRIORITIES, type CareType, type FormField, type Priority, type TriageRule } from "@/lib/profiles/schema";

// Motor da triagem: transforma as respostas do questionário em um atendimento
// configurado (serviço, modalidade, prioridade, etiquetas, recomendações,
// alertas). Funções puras; a página e o agendamento usam o resultado.

export type Answers = Record<string, string | string[]>;

export type TriageOutcome = {
  service: string;
  modality?: "IN_PERSON" | "ONLINE" | "HOME";
  priority: Priority;
  tags: string[];
  alerts: string[];
  recommendations: string[];
  stop?: string;
  summary: { label: string; answer: string }[];
};

const asList = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** Pergunta visível dadas as respostas (respeita "showIf"). */
export function isVisible(q: FormField, answers: Answers) {
  if (!q.showIf) return true;
  return asList(answers[q.showIf.field]).includes(q.showIf.equals);
}

export function matches(rule: TriageRule, answers: Answers) {
  const values = asList(answers[rule.if.field]).filter(Boolean);
  if (values.length === 0) return false;
  if (rule.if.equals !== undefined && !values.includes(rule.if.equals)) return false;
  if (rule.if.in && !values.some((v) => rule.if.in!.includes(v))) return false;
  if (rule.if.gte !== undefined && !values.some((v) => Number(v) >= rule.if.gte!)) return false;
  return true;
}

/** Erros de preenchimento (perguntas obrigatórias visíveis sem resposta). */
export function missingAnswers(careType: CareType, answers: Answers) {
  return careType.triage.questions
    .filter((q) => q.required && isVisible(q, answers) && asList(answers[q.key]).filter(Boolean).length === 0)
    .map((q) => q.label);
}

export function evaluateTriage(careType: CareType, answers: Answers): TriageOutcome {
  const out: TriageOutcome = { service: careType.services[0], priority: "NORMAL", tags: [], alerts: [], recommendations: [], summary: [] };
  for (const rule of careType.triage.rules) {
    if (!matches(rule, answers)) continue;
    const t = rule.then;
    if (t.service) out.service = t.service;
    if (t.modality) out.modality = t.modality;
    if (t.priority && PRIORITIES.indexOf(t.priority) > PRIORITIES.indexOf(out.priority)) out.priority = t.priority;
    for (const tag of t.tags ?? []) if (!out.tags.includes(tag)) out.tags.push(tag);
    if (t.alert && !out.alerts.includes(t.alert)) out.alerts.push(t.alert);
    if (t.recommend && !out.recommendations.includes(t.recommend)) out.recommendations.push(t.recommend);
    if (t.stop && !out.stop) out.stop = t.stop;
  }
  for (const q of careType.triage.questions) {
    if (!isVisible(q, answers)) continue;
    const v = asList(answers[q.key]).filter(Boolean);
    if (v.length) out.summary.push({ label: q.label, answer: v.join(", ") });
  }
  return out;
}

/** Lê as respostas de um formulário (prefixo dos campos: "t_"). */
export function answersFromForm(careType: CareType, form: FormData, prefix = "t_"): Answers {
  const a: Answers = {};
  for (const q of careType.triage.questions) {
    const values = form.getAll(`${prefix}${q.key}`).map(String).map((v) => v.trim()).filter(Boolean);
    if (!values.length) continue;
    a[q.key] = q.type === "multiselect" || q.type === "checklist" ? values : values[0];
  }
  // Respostas de perguntas ocultas (showIf) não contam.
  for (const q of careType.triage.questions) if (!isVisible(q, a)) delete a[q.key];
  return a;
}

export const priorityLabel: Record<Priority, string> = { NORMAL: "Prioridade normal", ALTA: "Prioridade alta", URGENTE: "Urgente" };
export const priorityTone = { NORMAL: "neutral", ALTA: "warning", URGENTE: "danger" } as const;
