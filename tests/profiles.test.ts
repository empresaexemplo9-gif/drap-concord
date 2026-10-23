import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseProfileConfig, resolveProfile } from "@/lib/profiles/schema";

const dir = join(__dirname, "../prisma/profiles");
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

describe("perfis profissionais (seed)", () => {
  it("inclui os 10 perfis iniciais", () => {
    expect(files).toHaveLength(10);
  });

  for (const file of files) {
    it(`${file} é válido e tem compliance pendente de validação`, () => {
      const { config } = JSON.parse(readFileSync(join(dir, file), "utf8"));
      const res = parseProfileConfig(config);
      if (!res.success) throw new Error(JSON.stringify(res.error.issues, null, 2));
      expect(res.data.compliance.validation).toBe("PENDENTE_VALIDACAO");
    });
  }

  it("recusa regra sensível já em modo automático", () => {
    const { config } = JSON.parse(readFileSync(join(dir, "psicologo.json"), "utf8"));
    config.rules[1].mode = "AUTO";
    const res = parseProfileConfig(config);
    expect(res.success).toBe(false);
  });

  it("personalizações do profissional não alteram o perfil-base", () => {
    const { config } = JSON.parse(readFileSync(join(dir, "personalizado.json"), "utf8"));
    const base = parseProfileConfig(config);
    if (!base.success) throw new Error("inválido");
    const resolved = resolveProfile(base.data, { terminology: { client: { singular: "tutor", plural: "tutores" } } });
    expect(resolved.terminology.client.singular).toBe("tutor");
    expect(base.data.terminology.client.singular).toBe("cliente");
  });
});
