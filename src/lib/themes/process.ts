import sharp from "sharp";
import { buildPalette, type Palette } from "./colors";

export const MAX_THEME_UPLOAD = 4 * 1024 * 1024;

/** Valida, otimiza (WebP até 2400px) e extrai a paleta de uma imagem de tema. */
export async function processThemeImage(input: Buffer) {
  const meta = await sharp(input).metadata();
  if (!meta.width || !meta.height || !["jpeg", "png", "webp", "avif"].includes(meta.format ?? "")) {
    throw new Error("Envie uma imagem JPG, PNG, WebP ou AVIF.");
  }
  if (meta.width < 1000) throw new Error("Use uma imagem com pelo menos 1000 px de largura, para não ficar borrada.");
  const pipeline = sharp(input).rotate().resize({ width: 2400, withoutEnlargement: true });
  const { data, info } = await pipeline.clone().webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  const small = await sharp(input).rotate().resize(64, 36, { fit: "cover" }).removeAlpha().raw().toBuffer();
  const palette: Palette = buildPalette(small, 3);
  return { data, mime: "image/webp", width: info.width, height: info.height, palette };
}

export const MAX_LOGO_UPLOAD = 2 * 1024 * 1024;

/** Logo da marca: aceita JPG, PNG, WebP, AVIF ou SVG e guarda como WebP (até 512 px, com transparência). */
export async function processLogo(input: Buffer) {
  const meta = await sharp(input, { density: 300 }).metadata();
  if (!meta.width || !meta.height || !["jpeg", "png", "webp", "avif", "svg"].includes(meta.format ?? "")) {
    throw new Error("Envie o logo em PNG, SVG, JPG ou WebP.");
  }
  const { data, info } = await sharp(input, { density: 300 })
    .rotate()
    .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: meta.format !== "svg" })
    .webp({ quality: 90, alphaQuality: 100 })
    .toBuffer({ resolveWithObject: true });
  return { data, mime: "image/webp", width: info.width, height: info.height };
}
