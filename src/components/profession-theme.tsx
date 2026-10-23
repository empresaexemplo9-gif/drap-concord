import { themeTokens } from "@/lib/themes/colors";
import type { ThemeInfo } from "@/lib/themes/load";

const decl = (tokens: Record<string, string>) =>
  Object.entries(tokens)
    .map(([k, v]) => `${k}:${v};`)
    .join("");

/**
 * Veste a página com o tema da profissão: a imagem cobre a tela inteira (nítida,
 * fixa ao rolar), as cores da plataforma passam a vir da própria imagem e todas
 * as superfícies (cartões, menus, campos) ganham efeito de vidro.
 */
export function ProfessionTheme({ theme }: { theme: ThemeInfo | null }) {
  if (!theme) return null;
  const t = themeTokens(theme.palette);
  // Só fundos aplicados de fato (não variantes como hover:bg-card/60).
  const glass = [".bg-card", ".bg-surface", ...["bg-card/", "bg-surface/", "bg-bg/"].flatMap((c) => [`[class^='${c}']`, `[class*=' ${c}']`])].join(",");
  const css = [
    `html:root[data-theme="light"]{${decl(t.light)}--shadow:var(--glass-shadow);}`,
    `html:root[data-theme="dark"]{${decl(t.dark)}--shadow:var(--glass-shadow);}`,
    `html,body{background:transparent;}`,
    `${glass}{-webkit-backdrop-filter:blur(18px) saturate(160%);backdrop-filter:blur(18px) saturate(160%);}`,
    `@media (prefers-reduced-transparency: reduce){${glass}{-webkit-backdrop-filter:none;backdrop-filter:none;}}`,
  ].join("");
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        {/* eslint-disable-next-line @next/next/no-img-element -- imagem servida pela própria API, já otimizada */}
        <img src={theme.url} alt="" className="h-full w-full object-cover" fetchPriority="high" decoding="async" />
        <div className="absolute inset-0" style={{ background: "var(--overlay)" }} />
      </div>
    </>
  );
}
