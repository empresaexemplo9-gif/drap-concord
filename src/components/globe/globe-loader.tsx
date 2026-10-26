"use client";

import dynamic from "next/dynamic";

// O globo usa WebGL: carrega só no navegador.
export const GlobeLoader = dynamic(() => import("./globe-explorer").then((m) => m.GlobeExplorer), {
  ssr: false,
  loading: () => <div className="flex h-[calc(100dvh-4.5rem)] min-h-[520px] items-center justify-center bg-[#0b1424] text-white/70">Carregando o globo…</div>,
});
