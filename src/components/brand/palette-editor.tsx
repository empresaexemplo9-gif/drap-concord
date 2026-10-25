"use client";

import { useState } from "react";

type Preset = { name: string; primary: string; accent: string };

const toHex = (rgb: number[]) => "#" + rgb.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0")).join("");
function hsl(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}
function fromHsl(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return toHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
}
/** Secundária que combina com a principal (tom deslocado no círculo de cores). */
const companion = (hex: string) => {
  const { h, s, l } = hsl(hex);
  return fromHsl((h + 150) % 360, Math.min(0.75, Math.max(0.45, s)), Math.min(0.55, Math.max(0.4, l)));
};

/** Cor principal e secundária: paletas prontas, cores do logo ou escolha livre. */
export function PaletteEditor({ primary, accent, autoPrimary, autoAccent, logo, presets }: { primary: string; accent: string; autoPrimary: boolean; autoAccent: boolean; logo: number[] | null; presets: readonly Preset[] }) {
  const [p, setP] = useState(primary);
  const [a, setA] = useState(accent);
  const [pMode, setPMode] = useState(autoPrimary ? "auto" : "custom");
  const [aMode, setAMode] = useState(autoAccent ? "auto" : "custom");
  const use = (np: string, na: string) => {
    setP(np);
    setA(na);
    setPMode("custom");
    setAMode("custom");
  };
  const radio = "size-5 accent-[var(--primary)]";
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium">Paletas prontas</p>
        <div className="flex flex-wrap gap-2">
          {logo && (
            <button type="button" onClick={() => use(toHex(logo), companion(toHex(logo)))} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary px-3 text-sm font-semibold text-primary">
              <span className="size-4 rounded-full" style={{ background: toHex(logo) }} /> Cores do meu logo
            </button>
          )}
          {presets.map((x) => (
            <button key={x.name} type="button" onClick={() => use(x.primary, x.accent)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-3 text-sm hover:border-primary" aria-label={`Paleta ${x.name}`}>
              <span className="flex"><span className="size-4 rounded-l-full" style={{ background: x.primary }} /><span className="size-4 rounded-r-full" style={{ background: x.accent }} /></span>
              {x.name}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Cor principal (botões e links)</legend>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name="colorMode" value="auto" checked={pMode === "auto"} onChange={() => setPMode("auto")} className={radio} /> Tirar da imagem de fundo</label>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name="colorMode" value="custom" checked={pMode === "custom"} onChange={() => setPMode("custom")} className={radio} /> Minha cor</label>
          <input type="color" name="primaryColor" value={p} onChange={(e) => { setP(e.target.value); setPMode("custom"); }} aria-label="Cor principal da marca" className="h-11 w-24 cursor-pointer rounded-xl border border-line bg-card p-1" />
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Cor secundária (destaques e selos)</legend>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name="accentMode" value="auto" checked={aMode === "auto"} onChange={() => setAMode("auto")} className={radio} /> Automática</label>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name="accentMode" value="custom" checked={aMode === "custom"} onChange={() => setAMode("custom")} className={radio} /> Minha cor</label>
          <input type="color" name="accentColor" value={a} onChange={(e) => { setA(e.target.value); setAMode("custom"); }} aria-label="Cor secundária da marca" className="h-11 w-24 cursor-pointer rounded-xl border border-line bg-card p-1" />
        </fieldset>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3 text-sm" aria-hidden>
        <span className="rounded-lg px-3 py-2 font-semibold text-white" style={{ background: p }}>Agendar</span>
        <span className="font-semibold" style={{ color: a }}>Destaque</span>
        <span className="text-muted">Prévia. O contraste é ajustado automaticamente para leitura.</span>
      </div>
    </div>
  );
}
