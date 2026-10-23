import { describe, expect, it } from "vitest";
import { consecutiveNoShows, evaluateDaysWithoutReturn, evaluateNoShow, render, type RuleLike } from "@/lib/rules/engine";
import psicologo from "../prisma/profiles/psicologo.json";

const now = new Date("2026-05-20T12:00:00Z");
const day = (n: number) => new Date(now.getTime() - n * 86_400_000);
const rules: RuleLike[] = psicologo.config.rules.map((r, i) => ({ ...r, id: `r${i}`, enabled: true }) as RuleLike);

describe("faltas consecutivas", () => {
  it("conta do mais recente para trás e para no primeiro realizado", () => {
    const h = [
      { startsAt: day(21), status: "NO_SHOW" },
      { startsAt: day(14), status: "DONE" },
      { startsAt: day(7), status: "NO_SHOW" },
      { startsAt: day(1), status: "NO_SHOW" },
    ];
    expect(consecutiveNoShows(h, now)).toBe(2);
  });

  it("ignora cancelados e atendimentos futuros", () => {
    const h = [
      { startsAt: day(7), status: "NO_SHOW" },
      { startsAt: day(3), status: "CANCELED_BY_CLIENT" },
      { startsAt: day(-3), status: "NO_SHOW" },
    ];
    expect(consecutiveNoShows(h, now)).toBe(1);
  });
});

describe("regra de faltas do perfil de psicologia", () => {
  const history = (n: number) => Array.from({ length: n }, (_, i) => ({ startsAt: day(7 * (i + 1)), status: "NO_SHOW" }));

  it("1 falta: nada acontece", () => {
    expect(evaluateNoShow(rules, history(1), { clientName: "Maria", now })).toHaveLength(0);
  });

  it("2 faltas: avisa o cliente automaticamente", () => {
    const [o, ...rest] = evaluateNoShow(rules, history(2), { clientName: "Maria", now });
    expect(rest).toHaveLength(0);
    expect(o.rule.key).toBe("faltas-aviso");
    expect(o.actions).toHaveLength(1);
    expect(o.actions[0].action.type).toBe("NOTIFY_CLIENT");
    expect(o.actions[0].requiresApproval).toBe(false);
    expect(o.actions[0].message).toContain("2 sessões");
  });

  it("3 faltas: avisa o cliente e PEDE confirmação do profissional antes de cancelar", () => {
    const [o] = evaluateNoShow(rules, history(3), { clientName: "Maria", now });
    expect(o.rule.key).toBe("faltas-cancelamento");
    const [notifyClient, cancel] = o.actions;
    expect(notifyClient.requiresApproval).toBe(false);
    expect(notifyClient.message).toContain("7 dias");
    expect(cancel.action.type).toBe("CANCEL_FUTURE");
    expect(cancel.requiresApproval).toBe(true);
    expect(cancel.message).toContain("Maria");
  });

  it("modo automático escolhido pelo profissional dispensa a aprovação", () => {
    const auto = rules.map((r) => ({ ...r, mode: "AUTO" as const }));
    const [o] = evaluateNoShow(auto, history(3), { clientName: "Maria", now });
    expect(o.actions.every((a) => !a.requiresApproval)).toBe(true);
  });

  it("regra desativada não dispara", () => {
    const off = rules.map((r) => ({ ...r, enabled: false }));
    expect(evaluateNoShow(off, history(2), { clientName: "Maria", now })).toHaveLength(0);
  });
});

describe("dias sem retorno", () => {
  const r: RuleLike = { id: "x", key: "k", name: "n", trigger: "DAYS_WITHOUT_RETURN", conditions: { days: 14 }, actions: [{ type: "NOTIFY_CLIENT", message: "{{days}} dias" }], mode: "AUTO", enabled: true };
  it("dispara exatamente no dia configurado", () => {
    expect(evaluateDaysWithoutReturn([r], day(14), false, { clientName: "A", now })).toHaveLength(1);
    expect(evaluateDaysWithoutReturn([r], day(13), false, { clientName: "A", now })).toHaveLength(0);
  });
  it("não dispara se já há atendimento futuro", () => {
    expect(evaluateDaysWithoutReturn([r], day(14), true, { clientName: "A", now })).toHaveLength(0);
  });
});

it("render mantém variáveis desconhecidas", () => {
  expect(render("Oi {{client}}, {{x}}", { client: "Ana" })).toBe("Oi Ana, {{x}}");
});
