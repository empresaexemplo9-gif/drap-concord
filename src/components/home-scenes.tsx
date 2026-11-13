import type { ReactNode } from "react";

// Página inicial com fundo liso e limpo: só as cores da plataforma e, bem de
// leve, a forma do logo. Sem fotos, funciona igual nos modos claro e escuro.

/** Fundo da home: cor sólida, um brilho suave no topo e o logo em marca d'água. */
export function HomeVisual() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
      <div
        className="absolute inset-x-0 top-0 h-[70vh]"
        style={{ background: "radial-gradient(80% 60% at 70% 0%, color-mix(in srgb, var(--primary) 9%, transparent), transparent 70%)" }}
      />
      <svg viewBox="0 0 778 781" className="absolute -right-[12vw] top-[8vh] w-[min(60vw,720px)] text-primary opacity-[0.045]" fill="currentColor">
        <path d="M0 0H533L212 781H0Z" />
        <path d="M581 2C601 2 777 60 777 290V480C777 675 652 781 512 781H219Z" />
      </svg>
    </div>
  );
}

export function Scene({ className = "", children }: { className?: string; children: ReactNode }) {
  return <section className={`relative ${className}`}>{children}</section>;
}
