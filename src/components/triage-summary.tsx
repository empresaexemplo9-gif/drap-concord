import { Alert, Badge } from "./ui";
import { modalityLabel } from "@/lib/format";
import { priorityLabel, priorityTone, type TriageOutcome } from "@/lib/triage/engine";

/** Resultado da triagem: prioridade, alertas, recomendações e (opcional) respostas. */
export function TriageSummary({ outcome, careTypeName, showAnswers = false, audience = "client" }: { outcome: TriageOutcome; careTypeName: string; showAnswers?: boolean; audience?: "client" | "professional" }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info">{careTypeName}</Badge>
        {(audience === "professional" || outcome.priority !== "NORMAL") && <Badge tone={priorityTone[outcome.priority]}>{priorityLabel[outcome.priority]}</Badge>}
        {outcome.modality && <Badge>{modalityLabel[outcome.modality]}</Badge>}
        {audience === "professional" && outcome.tags.map((t) => <Badge key={t}>{t}</Badge>)}
      </div>
      {outcome.alerts.map((a) => <Alert key={a} tone="danger">{a}</Alert>)}
      {outcome.recommendations.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-semibold">{audience === "professional" ? "Recomendações da triagem" : "Para o seu atendimento"}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">{outcome.recommendations.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
      {showAnswers && outcome.summary.length > 0 && (
        <details className="rounded-xl bg-surface p-3 text-sm" open={audience === "professional"}>
          <summary className="cursor-pointer font-semibold">Respostas</summary>
          <dl className="mt-2 space-y-2">
            {outcome.summary.map((s) => <div key={s.label}><dt className="text-muted">{s.label}</dt><dd className="font-medium">{s.answer}</dd></div>)}
          </dl>
        </details>
      )}
    </div>
  );
}
