import type { ReactNode } from "react";
import homeImages from "@/lib/home-images.json";
import type { Palette } from "@/lib/themes/colors";
import { Backdrop, themeCss } from "./profession-theme";

// Página inicial vestida por uma única imagem da plataforma, cobrindo a página
// inteira e fixa ao rolar; cores e vidro saem dela.

/** Cores e vidro tirados da imagem da home, mais a imagem cobrindo toda a página. */
export function HomeVisual() {
  const css = themeCss({ palette: homeImages.home as Palette, withImage: true });
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <Backdrop src="/home/home.webp" mobileSrc="/home/home-m.webp" />
    </>
  );
}

export function Scene({ className = "", children }: { className?: string; children: ReactNode }) {
  return <section className={`relative ${className}`}>{children}</section>;
}
