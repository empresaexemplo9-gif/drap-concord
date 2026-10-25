import { ensureContrast, hex, themeTokens, type Palette, type RGB } from "@/lib/themes/colors";
import { CORNERS } from "@/lib/brand";
import type { ThemeInfo } from "@/lib/themes/load";

const decl = (tokens: Record<string, string>) =>
  Object.entries(tokens)
    .map(([k, v]) => `${k}:${v};`)
    .join("");

const FONT_VARS = {
  classica: "var(--font-fraunces), ui-serif, Georgia, serif",
  moderna: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  elegante: "var(--font-playfair), ui-serif, Georgia, serif",
  amigavel: "var(--font-nunito), ui-rounded, system-ui, sans-serif",
} as const;

// Só a cor de destaque (fundo liso com cor própria): superfícies continuam as da plataforma.
const ACCENT_KEYS = ["--primary", "--primary-hover", "--on-primary", "--accent", "--ring"];
const pick = (t: Record<string, string>) => Object.fromEntries(Object.entries(t).filter(([k]) => ACCENT_KEYS.includes(k)));

/**
 * Veste a página com o visual do profissional: imagem cobrindo a tela inteira
 * (nítida, fixa ao rolar), cores tiradas da imagem ou da marca, fonte dos
 * títulos e, se ligado, efeito de vidro em cartões, menus e campos.
 */
/**
 * CSS do visual: com imagem, a paleta dela vira as cores da plataforma e as
 * superfícies (cartões, menus, campos) ganham vidro; sem imagem, só a cor de
 * destaque muda. Também troca a fonte dos títulos.
 */
export function themeCss({ palette, withImage, glass = true, font, accent, corners }: { palette: Palette | null; withImage: boolean; glass?: boolean; font?: ThemeInfo["font"]; accent?: RGB; corners?: ThemeInfo["corners"] }) {
  const css: string[] = [];
  if (corners && corners !== "suave") {
    const c = CORNERS[corners];
    css.push(`html:root{--corner-xl:${c.xl};--corner-2xl:${c.x2};--corner-3xl:${c.x3};}`);
  }
  if (font && font !== "classica") css.push(`html:root{--heading-font:${FONT_VARS[font]};}`);
  if (withImage && palette) {
    const t = themeTokens(palette, { solid: !glass });
    css.push(
      `html:root[data-theme="light"]{${decl(t.light)}--shadow:var(--glass-shadow);}`,
      `html:root[data-theme="dark"]{${decl(t.dark)}--shadow:var(--glass-shadow);}`,
      `html,body{background:transparent;}`,
      // Títulos de página ganham um painel para não competir com a imagem.
      `.page-header{background:var(--card);border:1px solid var(--border);border-radius:1.25rem;padding:1rem 1.25rem;box-shadow:var(--shadow);}`,
    );
    if (glass) {
      // Só fundos aplicados de fato (não variantes como hover:bg-card/60).
      const sel = [".bg-card", ".bg-surface", ".page-header", ...["bg-card/", "bg-surface/", "bg-bg/"].flatMap((c) => [`[class^='${c}']`, `[class*=' ${c}']`])].join(",");
      css.push(
        `${sel}{-webkit-backdrop-filter:blur(18px) saturate(160%);backdrop-filter:blur(18px) saturate(160%);}`,
        `@media (prefers-reduced-transparency: reduce){${sel}{-webkit-backdrop-filter:none;backdrop-filter:none;}}`,
      );
    }
  } else if (palette) {
    const t = themeTokens(palette);
    css.push(`html:root[data-theme="light"]{${decl(pick(t.light))}}`, `html:root[data-theme="dark"]{${decl(pick(t.dark))}}`);
  }
  // Cor secundária da marca (destaques, selos, foco), sempre com contraste legível.
  if (accent) {
    const light = hex(ensureContrast(accent, [255, 255, 255], 3, "darken"));
    const dark = hex(ensureContrast(accent, [12, 12, 14], 3, "lighten"));
    css.push(`html:root[data-theme="light"]{--accent:${light};--ring:${light};}`, `html:root[data-theme="dark"]{--accent:${dark};--ring:${dark};}`);
  }
  return css.join("");
}

/** Imagem cobrindo a tela inteira, nítida e fixa ao rolar, com o véu do tema por cima. */
export function Backdrop({ src, mobileSrc }: { src: string; mobileSrc?: string }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <picture>
        {mobileSrc && <source media="(max-width: 768px)" srcSet={mobileSrc} />}
        <img src={src} alt="" className="h-full w-full object-cover" fetchPriority="high" decoding="async" />
      </picture>
      <div className="absolute inset-0" style={{ background: "var(--overlay)" }} />
    </div>
  );
}

/** Veste a página com o visual do profissional (marca ou tema da profissão). */
export function ProfessionTheme({ theme }: { theme: ThemeInfo | null }) {
  if (!theme) return null;
  const withImage = !!(theme.url && theme.palette);
  const css = themeCss({ palette: theme.palette, withImage, glass: theme.glass !== false, font: theme.font, accent: theme.accent, corners: theme.corners });
  if (!css) return null;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {withImage && <Backdrop src={theme.url!} />}
    </>
  );
}
