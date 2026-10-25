// Gera as imagens da página inicial (public/home) e as paletas (src/lib/home-images.json).
// Uso: npx tsx scripts/home-images.ts <pasta com home.*>
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { buildPalette } from "../src/lib/themes/colors";

async function main() {
  const dir = process.argv[2];
  const out: Record<string, unknown> = {};
  for (const name of ["home"]) {
    const file = readdirSync(dir).find((f) => f.startsWith(`${name}.`));
    if (!file) throw new Error(`Falta ${name}.* em ${dir}`);
    const src = join(dir, file);
    await sharp(src).resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 80 }).toFile(`public/home/${name}.webp`);
    await sharp(src).resize({ width: 900 }).webp({ quality: 72 }).toFile(`public/home/${name}-m.webp`);
    const small = await sharp(src).resize(64, 36, { fit: "cover" }).removeAlpha().raw().toBuffer();
    out[name] = buildPalette(small, 3);
  }
  writeFileSync("src/lib/home-images.json", JSON.stringify(out, null, 2) + "\n");
}

main();
