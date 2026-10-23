import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export type Window = { weekday: number; startMin: number; endMin: number };
export type Busy = { startsAt: Date; endsAt: Date };

export type SlotInput = {
  from: Date;
  days: number;
  availability: Window[];
  busy: Busy[];
  durationMin: number;
  bufferMin?: number;
  stepMin?: number;
  minNoticeMin?: number;
  timezone: string;
  now: Date;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Horários livres (início em UTC) respeitando disponibilidade, bloqueios e buffer. */
export function computeSlots(input: SlotInput): Date[] {
  const { availability, busy, durationMin, timezone, now } = input;
  const buffer = input.bufferMin ?? 0;
  const step = input.stepMin ?? 30;
  const earliest = now.getTime() + (input.minNoticeMin ?? 60) * 60_000;
  const out: Date[] = [];

  for (let d = 0; d < input.days; d++) {
    const day = addDays(input.from, d);
    const date = formatInTimeZone(day, timezone, "yyyy-MM-dd");
    const weekday = Number(formatInTimeZone(day, timezone, "i")) % 7; // ISO: 7 = domingo
    for (const w of availability.filter((a) => a.weekday === weekday)) {
      for (let m = w.startMin; m + durationMin <= w.endMin; m += step) {
        const start = fromZonedTime(`${date}T${pad(Math.floor(m / 60))}:${pad(m % 60)}:00`, timezone);
        const end = new Date(start.getTime() + durationMin * 60_000);
        if (start.getTime() < earliest) continue;
        const clash = busy.some(
          (b) =>
            start.getTime() < b.endsAt.getTime() + buffer * 60_000 &&
            end.getTime() + buffer * 60_000 > b.startsAt.getTime(),
        );
        if (!clash) out.push(start);
      }
    }
  }
  return out.sort((a, b) => a.getTime() - b.getTime());
}

export function overlaps(a: Busy, b: Busy) {
  return a.startsAt < b.endsAt && a.endsAt > b.startsAt;
}
