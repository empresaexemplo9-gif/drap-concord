import type { ReactNode } from "react";
import homeImages from "@/lib/home-images.json";
import type { Palette } from "@/lib/themes/colors";
import { Backdrop, themeCss } from "./profession-theme";

// Página inicial vestida pelas três imagens da plataforma: "vida" cobre a
// página e a busca, "profissões" fica atrás dos profissionais e "rotina" no
// convite para profissionais. Cada cena mostra sua imagem fixa enquanto rola
// (clip-path recorta a imagem fixa na área da seção) e tudo em cima é vidro.

export type HomeImage = keyof typeof homeImages;

const src = (name: HomeImage) => ({ src: `/home/${name}.webp`, mobileSrc: `/home/${name}-m.webp` });

/** Cores e vidro tirados da imagem principal, mais a imagem cobrindo toda a página. */
export function HomeVisual() {
  const css = themeCss({ palette: homeImages.vida as Palette, withImage: true });
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <Backdrop {...src("vida")} />
    </>
  );
}

export function Scene({ image, className = "", children }: { image?: HomeImage; className?: string; children: ReactNode }) {
  return (
    <section className={`relative isolate ${image ? "[clip-path:inset(0)]" : ""} ${className}`}>
      {image && <Backdrop {...src(image)} />}
      {children}
    </section>
  );
}
