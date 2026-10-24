import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { profileConfigSchema, type CareType } from "@/lib/profiles/schema";
import { evaluateTriage, missingAnswers, answersFromForm } from "@/lib/triage/engine";

const dir = join(__dirname, "../prisma/profiles");
const load = (key: string) => profileConfigSchema.parse(JSON.parse(readFileSync(join(dir, `${key}.json`), "utf8")).config);
const ct = (key: string, type: string) => load(key).careTypes.find((c) => c.key === type)! as CareType;

describe("triagem: conteúdo", () => {
  it("toda profissão tem ao menos um tipo de atendimento com triagem", () => {
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
      expect(load(f.replace(".json", "")).careTypes.length).toBeGreaterThan(0);
    }
  });
});

describe("triagem: psicologia (terapia de adultos)", () => {
  const t = ct("psicologo", "terapia-adulto");
  const base = { motivo: ["Ansiedade"], risco: "Não", modalidade: "Presencial" };

  it("sem sinais de alerta: serviço padrão e prioridade normal", () => {
    const o = evaluateTriage(t, base);
    expect(o.service).toBe("Primeira sessão (acolhimento)");
    expect(o.priority).toBe("NORMAL");
    expect(o.stop).toBeUndefined();
  });

  it("online: escolhe a sessão online", () => {
    const o = evaluateTriage(t, { ...base, modalidade: "Online" });
    expect(o.service).toBe("Sessão online");
    expect(o.modality).toBe("ONLINE");
  });

  it("risco: urgente, alerta com CVV, mas não impede o agendamento", () => {
    const o = evaluateTriage(t, { ...base, risco: "Às vezes" });
    expect(o.priority).toBe("URGENTE");
    expect(o.alerts.join(" ")).toContain("188");
    expect(o.tags).toContain("atenção-risco");
    expect(o.stop).toBeUndefined();
  });

  it("prioridade fica com a mais alta (urgente vence alta)", () => {
    const o = evaluateTriage(t, { ...base, risco: "Sim, com frequência", impacto: "5" });
    expect(o.priority).toBe("URGENTE");
  });

  it("aponta perguntas obrigatórias sem resposta", () => {
    expect(missingAnswers(t, { motivo: ["Luto"] })).toEqual(expect.arrayContaining(["Como prefere ser atendido(a)?"]));
  });
});

describe("triagem: medicina (sinais de emergência)", () => {
  const t = ct("medico", "sintoma");
  it("sinal de alerta interrompe o agendamento e orienta o 192", () => {
    const o = evaluateTriage(t, { alerta: ["Dor ou aperto no peito"], queixa: "dor", tempo: "Começou hoje", modalidade: "Online" });
    expect(o.stop).toContain("192");
    expect(o.priority).toBe("URGENTE");
  });
  it("sem sinais de alerta segue para a consulta", () => {
    const o = evaluateTriage(t, { alerta: ["Nenhum destes"], queixa: "tosse", tempo: "Há alguns dias", modalidade: "Online" });
    expect(o.stop).toBeUndefined();
    expect(o.service).toBe("Teleconsulta");
  });
});

describe("triagem: regras em ordem e campos condicionais", () => {
  it("regra posterior vence (gestante: só avaliação, mesmo pedindo clareamento)", () => {
    const o = evaluateTriage(ct("dentista", "estetica"), { interesse: ["Clareamento"], gestante: "Sim" });
    expect(o.service).toBe("Avaliação");
    expect(o.tags).toContain("gestante");
  });
  it("respostas de perguntas ocultas (showIf) são descartadas", () => {
    const t = ct("psicologo", "avaliacao");
    const form = new FormData();
    form.set("t_finalidade", "Escolar");
    form.set("t_prazo", "Não");
    form.set("t_data_prazo", "2027-01-10");
    const a = answersFromForm(t, form);
    expect(a.data_prazo).toBeUndefined();
    expect(a.prazo).toBe("Não");
  });
  it("número >= limiar", () => {
    const o = evaluateTriage(ct("fisioterapeuta", "ortopedia"), { regiao: ["Joelho"], dor: "9", origem: "Lesão no esporte", sinais: ["Nenhum destes"], local: "Na clínica" });
    expect(o.priority).toBe("ALTA");
  });
});
