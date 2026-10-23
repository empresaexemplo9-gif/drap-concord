import { Alert, Button, Card, Field, Input, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { requireProfessional } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmt, minToHHMM, weekdays } from "@/lib/format";
import { addTimeOff, removeTimeOff, saveAvailability } from "../actions";

export const metadata = { title: "Horários" };

export default async function Horarios({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { professional } = await requireProfessional();
  const { ok, erro } = await searchParams;
  const [avail, timeOff] = await Promise.all([
    db.availability.findMany({ where: { professionalId: professional.id }, orderBy: [{ weekday: "asc" }, { startMin: "asc" }] }),
    db.timeOff.findMany({ where: { professionalId: professional.id, endsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" } }),
  ]);
  const tz = professional.timezone;
  const order = [1, 2, 3, 4, 5, 6, 0];

  return (
    <>
      <PageHeader title="Horários de atendimento" subtitle={`Fuso: ${tz.replace("_", " ")}`} />
      {ok && <div className="mb-4"><Alert tone="success">Horários salvos.</Alert></div>}
      {erro && <div className="mb-4"><Alert tone="danger">{erro}</Alert></div>}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <form action={saveAvailability} className="space-y-4">
            <p className="text-sm text-muted">Até dois intervalos por dia (ex.: manhã e tarde).</p>
            {order.map((d) => {
              const rows = avail.filter((a) => a.weekday === d);
              return (
                <fieldset key={d} className="grid items-center gap-2 border-b border-line pb-3 sm:grid-cols-[130px_1fr]">
                  <label className="flex min-h-11 items-center gap-2 font-medium">
                    <input type="checkbox" name={`on_${d}`} defaultChecked={rows.length > 0} className="size-5 accent-[var(--primary)]" />
                    {weekdays[d]}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1].map((i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <Input aria-label={`${weekdays[d]} início ${i + 1}`} type="time" name={`start_${d}_${i}`} defaultValue={rows[i] ? minToHHMM(rows[i].startMin) : ""} className="px-2" />
                        <span className="text-muted" aria-hidden>–</span>
                        <Input aria-label={`${weekdays[d]} fim ${i + 1}`} type="time" name={`end_${d}_${i}`} defaultValue={rows[i] ? minToHHMM(rows[i].endMin) : ""} className="px-2" />
                      </div>
                    ))}
                  </div>
                </fieldset>
              );
            })}
            <Field label="Intervalo entre atendimentos (min)" htmlFor="bufferMin" hint="Tempo livre automático antes e depois de cada atendimento.">
              <Input id="bufferMin" name="bufferMin" type="number" min={0} step={5} defaultValue={professional.bufferMin} className="max-w-32" />
            </Field>
            <SubmitButton>Salvar horários</SubmitButton>
          </form>
        </Card>
        <Card className="h-fit">
          <h2 className="mb-3 text-lg font-semibold">Bloqueios e folgas</h2>
          <form action={addTimeOff} className="space-y-3">
            <Field label="Início" htmlFor="start"><Input id="start" name="start" type="datetime-local" required /></Field>
            <Field label="Fim" htmlFor="end"><Input id="end" name="end" type="datetime-local" required /></Field>
            <Field label="Motivo (opcional)" htmlFor="reason"><Input id="reason" name="reason" placeholder="Férias, congresso…" /></Field>
            <SubmitButton variant="secondary">Bloquear período</SubmitButton>
          </form>
          {timeOff.length > 0 && (
            <ul className="mt-5 space-y-2 text-sm">
              {timeOff.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2">
                  <span>{fmt(t.startsAt, "dd/MM HH:mm", tz)} → {fmt(t.endsAt, "dd/MM HH:mm", tz)}{t.reason && ` · ${t.reason}`}</span>
                  <form action={removeTimeOff}><input type="hidden" name="id" value={t.id} /><Button variant="ghost" className="min-h-9 px-2">Remover</Button></form>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
