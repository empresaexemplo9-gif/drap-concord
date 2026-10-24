import { formatInTimeZone } from "date-fns-tz";
import { ptBR } from "date-fns/locale";

/** Lista de horários livres agrupados por dia, como radios (funciona sem JS). */
export function SlotPicker({ slots, tz, name = "start", max = 14, required = true }: { slots: Date[]; tz: string; name?: string; max?: number; required?: boolean }) {
  const groups = new Map<string, Date[]>();
  for (const s of slots) {
    const k = formatInTimeZone(s, tz, "yyyy-MM-dd");
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  const days = [...groups.entries()].slice(0, max);
  if (days.length === 0) return <p className="rounded-xl bg-surface p-4 text-sm text-muted">Sem horários livres nos próximos dias.</p>;
  return (
    <div className="space-y-4">
      {days.map(([day, list]) => (
        <fieldset key={day}>
          <legend className="mb-2 text-sm font-semibold first-letter:uppercase">{formatInTimeZone(list[0], tz, "EEEE, d 'de' MMMM", { locale: ptBR })}</legend>
          <div className="flex flex-wrap gap-2">
            {list.map((s) => (
              <label key={s.toISOString()} className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-line bg-card px-3.5 text-sm font-medium has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-on-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent">
                <input type="radio" name={name} value={s.toISOString()} className="sr-only" required={required} />
                {formatInTimeZone(s, tz, "HH:mm")}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
