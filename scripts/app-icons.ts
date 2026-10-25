// Gera todos os ícones do app a partir do ícone original (public/icons/icon.svg):
// tamanhos para Android, iOS/iPadOS, Windows, macOS, Linux e ChromeOS, versão
// "maskable" (Android recorta em círculo/gota), monocromática (ícones temáticos
// do Android 13+), apple-touch e favicon.ico.
// Uso: npx tsx scripts/app-icons.ts
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const CREAM = "#FBF7F2";
const TEAL = "#1F4E5A";
const MARK = `<g><path d="M0 0H533L212 781H0Z"/><path d="M581 2C601 2 777 60 777 290V480C777 675 652 781 512 781H219Z"/></g>`;

/** Marca centralizada ocupando `scale` do quadro, sobre fundo opcional. */
const svg = (scale: number, bg: string | null, fill: string, radius = 0) => {
  const box = 778 / scale;
  const off = (box - 778) / 2;
  const offY = (box - 781) / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-off} ${-offY} ${box} ${box}">` +
      (bg ? `<rect x="${-off}" y="${-offY}" width="${box}" height="${box}" rx="${radius * box}" fill="${bg}"/>` : "") +
      `<g fill="${fill}">${MARK}</g></svg>`,
  );
};

async function png(input: Buffer, size: number, out: string) {
  await sharp(input, { density: 600 }).resize(size, size).png({ compressionLevel: 9 }).toFile(out);
}

/** ICO com PNGs embutidos (aceito por todos os navegadores e pelo Windows). */
async function ico(input: Buffer, sizes: number[], out: string) {
  const images = await Promise.all(sizes.map((s) => sharp(input, { density: 600 }).resize(s, s).png().toBuffer()));
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((img, i) => {
    const e = 6 + i * 16;
    header.writeUInt8(sizes[i] >= 256 ? 0 : sizes[i], e);
    header.writeUInt8(sizes[i] >= 256 ? 0 : sizes[i], e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(img.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += img.length;
  });
  writeFileSync(out, Buffer.concat([header, ...images]));
}

async function main() {
  const dir = "public/icons";
  // Ícone padrão: o original (quadro creme arredondado com a marca).
  const original = readFileSync(`${dir}/icon.svg`);
  for (const s of [48, 72, 96, 128, 144, 152, 192, 256, 384, 512, 1024]) await png(original, s, `${dir}/icon-${s}.png`);
  // Maskable: fundo ocupando tudo e marca dentro da zona segura (80% do centro).
  const maskable = svg(0.56, CREAM, TEAL);
  for (const s of [192, 512]) await png(maskable, s, `${dir}/maskable-${s}.png`);
  // Monocromático: só a forma (o sistema aplica a cor do tema).
  await png(svg(0.56, null, "#FFFFFF"), 512, `${dir}/monochrome-512.png`);
  // iOS/iPadOS arredonda sozinho: fundo cheio, sem cantos.
  await png(svg(0.62, CREAM, TEAL), 180, `${dir}/apple-touch-icon.png`);
  for (const s of [152, 167]) await png(svg(0.62, CREAM, TEAL), s, `${dir}/apple-touch-icon-${s}.png`);
  // Windows (atalhos e bloco do menu Iniciar).
  await png(svg(0.62, TEAL, CREAM), 310, `${dir}/mstile-310.png`);
  await ico(original, [16, 32, 48, 64, 256], "src/app/favicon.ico");
}

main();
