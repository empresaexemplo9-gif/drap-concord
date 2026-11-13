// Cores "simbióticas": paleta extraída da imagem da profissão e tokens de
// tema (vidro, texto, acento) com contraste WCAG garantido. Funções puras.

export type RGB = [number, number, number];

export type Palette = {
  average: RGB;
  vibrant: RGB;
  /** Luminância relativa média da imagem (0 = preta, 1 = branca). */
  brightness: number;
};

const clamp = (n: number, a = 0, b = 255) => Math.min(b, Math.max(a, n));

export const hex = ([r, g, b]: RGB) =>
  "#" + [r, g, b].map((c) => Math.round(clamp(c)).toString(16).padStart(2, "0")).join("");

export const rgba = ([r, g, b]: RGB, a: number) =>
  `rgba(${Math.round(clamp(r))}, ${Math.round(clamp(g))}, ${Math.round(clamp(b))}, ${a})`;

export function luminance([r, g, b]: RGB) {
  const ch = (c: number) => {
    const s = clamp(c) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrast(a: RGB, b: RGB) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

export const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export function toHsv([r, g, b]: RGB) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

/**
 * Paleta a partir de pixels RGB (já reduzidos, ex.: 64x36). A cor "vibrante"
 * é o grupo de matiz com mais pixels saturados e claros: a cor marcante da cena.
 */
export function buildPalette(pixels: Uint8Array | Buffer, channels = 3): Palette {
  let sr = 0, sg = 0, sb = 0, n = 0, lum = 0;
  const bins = new Map<number, { score: number; r: number; g: number; b: number; w: number }>();
  for (let i = 0; i + 2 < pixels.length; i += channels) {
    const c: RGB = [pixels[i], pixels[i + 1], pixels[i + 2]];
    sr += c[0]; sg += c[1]; sb += c[2]; n++;
    lum += luminance(c);
    const { h, s, v } = toHsv(c);
    if (s < 0.3 || v < 0.3) continue;
    const key = Math.floor(h / 20);
    const w = s * v;
    const bin = bins.get(key) ?? { score: 0, r: 0, g: 0, b: 0, w: 0 };
    bin.score += w; bin.r += c[0] * w; bin.g += c[1] * w; bin.b += c[2] * w; bin.w += w;
    bins.set(key, bin);
  }
  const average: RGB = n ? [sr / n, sg / n, sb / n] : [128, 128, 128];
  const best = [...bins.values()].sort((a, b) => b.score - a.score)[0];
  const vibrant: RGB = best ? [best.r / best.w, best.g / best.w, best.b / best.w] : average;
  return { average, vibrant, brightness: n ? lum / n : 0.5 };
}

/** Escurece (ou clareia) uma cor até atingir o contraste mínimo contra `against`. */
export function ensureContrast(color: RGB, against: RGB, min: number, direction: "darken" | "lighten"): RGB {
  let c = color;
  const target: RGB = direction === "darken" ? [0, 0, 0] : [255, 255, 255];
  for (let i = 0; i < 40 && contrast(c, against) < min; i++) c = mix(c, target, 0.06);
  return c;
}

/**
 * Tira parte da saturação de uma cor (mistura com o cinza de mesma luminância
 * percebida). Deixa as cores tiradas das fotos mais sóbrias e agradáveis.
 */
export function soften(color: RGB, amount = 0.4): RGB {
  const [r, g, b] = color;
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  return mix(color, [gray, gray, gray], amount);
}

export type ThemeTokens = Record<string, string>;

const WHITE: RGB = [255, 255, 255];
const INK: RGB = [27, 36, 43];
const NIGHT: RGB = [12, 14, 16];
const PAPER: RGB = [234, 239, 242];

/**
 * Tokens de tema para o modo claro e escuro. Os nomes batem com as variáveis
 * de globals.css, então todo componente da plataforma "veste" o tema.
 */
export function themeTokens(p: Palette, opts: { solid?: boolean } = {}): { light: ThemeTokens; dark: ThemeTokens } {
  // Sem efeito de vidro, os cartões ficam quase opacos para manter a leitura sobre a imagem.
  const a = (glass: number, solid: number) => (opts.solid ? solid : glass);
  // A cor marcante da foto entra mais sóbria; o vidro quase não puxa a cor da cena.
  const tone = soften(p.vibrant, 0.4);
  const lightPrimary = ensureContrast(tone, WHITE, 4.6, "darken");
  const darkPrimary = ensureContrast(tone, NIGHT, 7, "lighten");
  const lightGlass = mix(WHITE, p.average, 0.06);
  const darkGlass = mix(NIGHT, p.average, 0.16);
  const accentLight = ensureContrast(tone, WHITE, 4.5, "darken");
  const accentDark = ensureContrast(tone, NIGHT, 4.5, "lighten");

  const common = { "--danger": "#a2453a" };
  return {
    light: {
      ...common,
      "--bg": rgba(lightGlass, 0.2),
      "--surface": rgba(lightGlass, a(0.7, 0.92)),
      "--card": rgba(lightGlass, a(0.86, 0.97)),
      "--primary": hex(lightPrimary),
      "--primary-hover": hex(mix(lightPrimary, [0, 0, 0], 0.15)),
      "--on-primary": "#ffffff",
      "--accent": hex(accentLight),
      "--ring": hex(accentLight),
      "--text": hex(INK),
      "--muted": "#46535c",
      "--border": "rgba(255, 255, 255, 0.7)",
      "--overlay": `linear-gradient(180deg, ${rgba(lightGlass, 0.5)}, ${rgba(lightGlass, 0.72)})`,
      "--glass-shadow": "0 1px 2px rgb(16 24 32 / 0.04), 0 10px 28px -14px rgb(16 24 32 / 0.18)",
    },
    dark: {
      "--bg": rgba(darkGlass, 0.25),
      "--surface": rgba(darkGlass, a(0.66, 0.9)),
      "--card": rgba(darkGlass, a(0.78, 0.96)),
      "--primary": hex(darkPrimary),
      "--primary-hover": hex(mix(darkPrimary, WHITE, 0.15)),
      "--on-primary": hex(NIGHT),
      "--accent": hex(accentDark),
      "--ring": hex(accentDark),
      "--text": hex(PAPER),
      "--muted": "#c3ccd2",
      "--border": "rgba(255, 255, 255, 0.12)",
      "--danger": "#e8998d",
      "--overlay": `linear-gradient(180deg, ${rgba(darkGlass, 0.62)}, ${rgba(darkGlass, 0.8)})`,
      "--glass-shadow": "0 1px 1px rgb(0 0 0 / 0.3), 0 16px 40px -16px rgb(0 0 0 / 0.6)",
    },
  };
}
