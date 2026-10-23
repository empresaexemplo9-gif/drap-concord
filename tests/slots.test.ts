import { describe, expect, it } from "vitest";
import { computeSlots } from "@/lib/slots";

const TZ = "America/Sao_Paulo";
// Segunda-feira, 18/05/2026, 08:00 em São Paulo (UTC-3).
const monday = new Date("2026-05-18T11:00:00Z");
const base = {
  from: monday,
  days: 1,
  availability: [{ weekday: 1, startMin: 9 * 60, endMin: 12 * 60 }],
  busy: [],
  durationMin: 60,
  timezone: TZ,
  now: new Date("2026-05-17T12:00:00Z"),
};

describe("horários livres", () => {
  it("gera horários dentro da disponibilidade, no fuso do profissional", () => {
    const slots = computeSlots({ ...base, stepMin: 60 });
    expect(slots.map((s) => s.toISOString())).toEqual([
      "2026-05-18T12:00:00.000Z",
      "2026-05-18T13:00:00.000Z",
      "2026-05-18T14:00:00.000Z",
    ]);
  });

  it("remove horários ocupados e respeita o buffer", () => {
    const busy = [{ startsAt: new Date("2026-05-18T13:00:00Z"), endsAt: new Date("2026-05-18T13:30:00Z") }]; // 10:00-10:30 local
    const slots = computeSlots({ ...base, stepMin: 30, busy, bufferMin: 15 });
    expect(slots.map((s) => s.toISOString())).toEqual(["2026-05-18T14:00:00.000Z"]);
  });

  it("não oferece horários no passado nem sem antecedência mínima", () => {
    const now = new Date("2026-05-18T12:30:00Z"); // 09:30 local
    const slots = computeSlots({ ...base, stepMin: 60, now, minNoticeMin: 60 });
    expect(slots.map((s) => s.toISOString())).toEqual(["2026-05-18T14:00:00.000Z"]);
  });

  it("dia sem disponibilidade não tem horários", () => {
    expect(computeSlots({ ...base, from: new Date("2026-05-17T11:00:00Z") })).toEqual([]);
  });
});
