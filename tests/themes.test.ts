import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPalette, contrast, themeTokens, type RGB } from "@/lib/themes/colors";
import { processThemeImage } from "@/lib/themes/process";

const dir = join(__dirname, "../prisma/themes");
const hexToRgb = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;

describe("temas das profissões", () => {
  const files = readdirSync(dir).filter((f) => f.endsWith(".webp"));

  it("todo tema do themes.json tem arquivo de imagem", () => {
    const list: { file: string }[] = JSON.parse(readFileSync(join(dir, "themes.json"), "utf8"));
    for (const t of list) expect(files).toContain(t.file);
  });

  for (const file of files) {
    it(`${file}: botões e textos passam no contraste AA nos modos claro e escuro`, async () => {
      const { palette, width } = await processThemeImage(readFileSync(join(dir, file)));
      expect(width).toBeGreaterThanOrEqual(1000);
      const { light, dark } = themeTokens(palette);
      expect(contrast(hexToRgb(light["--primary"]), hexToRgb(light["--on-primary"]))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(hexToRgb(dark["--primary"]), hexToRgb(dark["--on-primary"]))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(hexToRgb(light["--text"]), [255, 255, 255])).toBeGreaterThanOrEqual(7);
      expect(contrast(hexToRgb(dark["--text"]), [12, 12, 14])).toBeGreaterThanOrEqual(7);
    });
  }
});

it("cor vibrante é a da cena, não a média", () => {
  // Metade laranja forte, metade cinza: a vibrante deve ser laranja.
  const px: number[] = [];
  for (let i = 0; i < 50; i++) px.push(240, 120, 30);
  for (let i = 0; i < 50; i++) px.push(120, 120, 120);
  const p = buildPalette(Uint8Array.from(px));
  expect(p.vibrant[0]).toBeGreaterThan(200);
  expect(p.vibrant[2]).toBeLessThan(60);
});

it("recusa imagens pequenas demais", async () => {
  const sharp = (await import("sharp")).default;
  const tiny = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#336699" } }).png().toBuffer();
  await expect(processThemeImage(tiny)).rejects.toThrow(/1000 px/);
});
