import { themeTokens } from "@/lib/themes/colors";
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
export function ProfessionTheme({ theme }: { theme: ThemeInfo | null }) {
  if (!theme) return null;
  const css: string[] = [];
  if (theme.font && theme.font !== "classica") css.push(`html:root{--heading-font:${FONT_VARS[theme.font]};}`);
  const glassOn = theme.glass !== false;

  if (theme.url && theme.palette) {
    const t = themeTokens(theme.palette, { solid: !glassOn });
    css.push(
      `html:root[data-theme="light"]{${decl(t.light)}--shadow:var(--glass-shadow);}`,
      `html:root[data-theme="dark"]{${decl(t.dark)}--shadow:var(--glass-shadow);}`,
      `html,body{background:transparent;}`,
      // Títulos de página ganham um painel para não competir com a imagem.
      `.page-header{background:var(--card);border:1px solid var(--border);border-radius:1.25rem;padding:1rem 1.25rem;box-shadow:var(--shadow);}`,
    );
    if (glassOn) {
      // Só fundos aplicados de fato (não variantes como hover:bg-card/60).
      const glass = [".bg-card", ".bg-surface", ".page-header", ...["bg-card/", "bg-surface/", "bg-bg/"].flatMap((c) => [`[class^='${c}']`, `[class*=' ${c}']`])].join(",");
      css.push(
        `${glass}{-webkit-backdrop-filter:blur(18px) saturate(160%);backdrop-filter:blur(18px) saturate(160%);}`,
        `@media (prefers-reduced-transparency: reduce){${glass}{-webkit-backdrop-filter:none;backdrop-filter:none;}}`,
      );
    }
  } else if (theme.palette) {
    const t = themeTokens(theme.palette);
    css.push(`html:root[data-theme="light"]{${decl(pick(t.light))}}`, `html:root[data-theme="dark"]{${decl(pick(t.dark))}}`);
  }
  if (!css.length) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css.join("") }} />
      {theme.url && theme.palette && (
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          {/* eslint-disable-next-line @next/next/no-img-element -- imagem servida pela própria API, já otimizada */}
          <img src={theme.url} alt="" className="h-full w-full object-cover" fetchPriority="high" decoding="async" />
          <div className="absolute inset-0" style={{ background: "var(--overlay)" }} />
        </div>
      )}
    </>
  );
}
