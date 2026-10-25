"use client";

import { useEffect, useState } from "react";

// Central de download do app: detecta o sistema e oferece o instalador próprio
// daquele sistema (baixado pelo navegador), além da instalação direta pelo
// navegador quando ele permite.

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
export type PlatformKey = "android" | "iphone" | "ipad" | "windows" | "mac" | "linux" | "chromeos";
export type DownloadFiles = Record<string, { size: number; sha256: string }>;

type FileLink = { file: string; label: string; detail: string };
type Platform = { name: string; device: string; icon: string; files: FileLink[]; steps: string[]; note?: string; browserSteps?: string[] };

const PLATFORMS: Record<PlatformKey, Platform> = {
  android: {
    name: "Android",
    device: "Celulares e tablets com Android 7 ou mais recente",
    icon: "M7 4l1.5 2.5M17 4l-1.5 2.5M5 10a7 7 0 0 1 14 0v7H5zM9 13h.01M15 13h.01",
    files: [{ file: "drap-concord.apk", label: "Baixar o app para Android (.apk)", detail: "Celulares e tablets" }],
    steps: [
      "Toque em Baixar o app para Android e abra o arquivo baixado.",
      "Se o Android pedir, permita instalar apps desta fonte (só nesta vez).",
      "Toque em Instalar. O DRAP Concord aparece na tela inicial.",
    ],
    note: "O app pede câmera e microfone só na hora das chamadas, e a localização só na busca por perto.",
  },
  iphone: {
    name: "iPhone",
    device: "iOS 16.4 ou mais recente",
    icon: "M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2",
    files: [],
    steps: ["Abra esta página no Safari.", "Toque em Compartilhar (quadrado com seta para cima).", "Escolha Adicionar à Tela de Início e toque em Adicionar."],
    note: "A Apple não permite instalar arquivos de apps baixados fora da App Store; no iPhone a instalação é feita pelo próprio Safari, como acima, com ícone e tela cheia.",
  },
  ipad: {
    name: "iPad",
    device: "iPadOS 16.4 ou mais recente",
    icon: "M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2",
    files: [],
    steps: ["Abra esta página no Safari.", "Toque em Compartilhar no topo da tela.", "Escolha Adicionar à Tela de Início e toque em Adicionar."],
    note: "A Apple não permite instalar arquivos de apps baixados fora da App Store; no iPad a instalação é feita pelo próprio Safari.",
  },
  windows: {
    name: "Windows",
    device: "Windows 10 e 11",
    icon: "M3 5l8-1v8H3zM13 4l8-1v9h-8zM3 13h8v8l-8-1zM13 13h8v9l-8-1z",
    files: [
      { file: "DRAP-Concord-Windows-x64.exe", label: "Baixar para Windows (.exe)", detail: "Intel e AMD (a maioria dos computadores)" },
      { file: "DRAP-Concord-Windows-ARM64.exe", label: "Windows ARM", detail: "Notebooks com processador Snapdragon" },
    ],
    steps: [
      "Baixe o arquivo e abra-o (não precisa instalar nada além dele).",
      "Se aparecer \"O Windows protegeu o computador\", clique em Mais informações → Executar assim mesmo.",
      "Para fixar: clique com o botão direito no ícone da barra de tarefas → Fixar na barra de tarefas.",
    ],
    note: "Usa o motor do Edge que já vem no Windows. Seus dados ficam guardados no seu usuário do Windows.",
  },
  mac: {
    name: "macOS",
    device: "Mac com Intel ou Apple Silicon",
    icon: "M16 3c-1 .1-2.2.8-2.8 1.6-.6.7-1 1.8-.9 2.8 1 .1 2.2-.6 2.8-1.4.6-.8 1-1.9.9-3zM19 16.5c-.5 1.2-.8 1.7-1.4 2.7-.9 1.4-2.2 3.1-3.8 3.1-1.4 0-1.8-.9-3.7-.9s-2.3.9-3.7.9c-1.6 0-2.8-1.6-3.7-3-2.5-3.9-2.8-8.5-1.2-10.9 1.1-1.7 2.9-2.7 4.6-2.7s2.8.9 4.2.9c1.4 0 2.2-.9 4.2-.9 1.5 0 3.1.8 4.2 2.2-3.7 2-3.1 7.3.3 8.6z",
    files: [{ file: "DRAP-Concord-macOS.zip", label: "Baixar para Mac (.zip)", detail: "Intel e Apple Silicon" }],
    steps: [
      "Baixe e abra o arquivo .zip; arraste o DRAP Concord para a pasta Aplicativos.",
      "Na primeira vez, se o Mac bloquear: Ajustes do Sistema → Privacidade e Segurança → Abrir Mesmo Assim.",
      "Abre em janela própria no Chrome, Edge ou Brave; sem eles, no Safari.",
    ],
    browserSteps: ["No Safari 17+: menu Arquivo → Adicionar ao Dock."],
  },
  linux: {
    name: "Linux",
    device: "Ubuntu, Debian, Mint, Fedora, Arch e outros",
    icon: "M12 2c-2 0-3 2-3 4.5 0 1.5-.5 2.5-1.5 4S5 14 5 16c0 1 .5 2 1.5 2.5L6 21h12l-.5-2.5c1-.5 1.5-1.5 1.5-2.5 0-2-1.5-4-2.5-5.5S15 8 15 6.5C15 4 14 2 12 2z",
    files: [
      { file: "drap-concord_1.0.0_all.deb", label: "Baixar para Ubuntu/Debian (.deb)", detail: "Abra com o Instalador de Programas" },
      { file: "drap-concord-linux.tar.gz", label: "Outras distribuições (.tar.gz)", detail: "Extraia e rode ./instalar.sh" },
    ],
    steps: [
      "Ubuntu, Debian e Mint: abra o .deb baixado e clique em Instalar.",
      "Outras: extraia o .tar.gz e rode ./instalar.sh (não precisa de administrador).",
      "Procure DRAP Concord no menu de aplicativos.",
    ],
    note: "Abre em janela própria usando Chromium, Chrome, Edge ou Brave instalados no sistema.",
  },
  chromeos: {
    name: "ChromeOS",
    device: "Chromebooks",
    icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 8h9M8.5 14 4 6.3M15.5 14 11 21.9",
    files: [],
    steps: ["Abra esta página no Chrome.", "Clique em Instalar (ícone na barra de endereço) ou no botão abaixo.", "O Concord fica na estante e no inicializador de apps."],
  },
};

function detect(): PlatformKey | null {
  const ua = navigator.userAgent;
  if (/CrOS/.test(ua)) return "chromeos";
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPod/.test(ua)) return "iphone";
  if (/iPad/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ipad";
  if (/Windows/.test(ua)) return "windows";
  if (/Macintosh|Mac OS X/.test(ua)) return "mac";
  if (/Linux/.test(ua)) return "linux";
  return null;
}

const mb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);

function PlatformIcon({ d, className = "size-6" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d={d} />
    </svg>
  );
}

export function DownloadCenter({ qrSvg, files }: { qrSvg: string; files: DownloadFiles }) {
  const [platform, setPlatform] = useState<PlatformKey | null>(null);
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [selected, setSelected] = useState<PlatformKey>("android");

  useEffect(() => {
    const p = detect();
    setPlatform(p);
    if (p) setSelected(p);
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    const read = () => setPrompt((window as unknown as { __installPrompt?: InstallEvent }).__installPrompt ?? null);
    const done = () => {
      setInstalled(true);
      setPrompt(null);
    };
    read();
    addEventListener("concord:installable", read);
    addEventListener("concord:installed", done);
    return () => {
      removeEventListener("concord:installable", read);
      removeEventListener("concord:installed", done);
    };
  }, []);

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setPrompt(null);
  };

  const info = PLATFORMS[selected];
  const mobile = platform === "android" || platform === "iphone" || platform === "ipad";
  const available = info.files.filter((f) => files[f.file]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
      <div className="rounded-3xl border border-line bg-card p-6 shadow-soft sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-surface text-primary"><PlatformIcon d={info.icon} /></span>
          <div>
            <p className="text-sm text-muted">{platform === selected ? "Seu aparelho" : "Baixar para"}</p>
            <h2 className="text-2xl font-semibold">{info.name}</h2>
          </div>
        </div>
        <p className="mt-1 text-sm text-muted">{info.device}</p>

        {installed && platform === selected && <p className="mt-6 rounded-2xl bg-success-bg p-4 font-semibold text-success">✓ O Concord já está instalado neste aparelho.</p>}

        {available.length > 0 && (
          <div className="mt-6 grid gap-3">
            {available.map((f, i) => (
              <a
                key={f.file}
                href={`/downloads/${f.file}`}
                download
                className={`flex min-h-16 items-center gap-4 rounded-2xl px-5 py-3 ${i === 0 ? "bg-primary text-on-primary hover:bg-primary-hover" : "border border-line hover:bg-surface"}`}
              >
                <svg viewBox="0 0 24 24" className="size-6 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3" /></svg>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-semibold">{f.label}</span>
                  <span className={`block text-sm ${i === 0 ? "opacity-85" : "text-muted"}`}>{f.detail} · {mb(files[f.file].size)}</span>
                </span>
              </a>
            ))}
          </div>
        )}

        {prompt && platform === selected && !installed && (
          <button onClick={install} className={`mt-3 inline-flex min-h-14 items-center gap-2 rounded-2xl px-6 font-semibold ${available.length ? "border border-line hover:bg-surface" : "bg-primary text-lg text-on-primary hover:bg-primary-hover"}`}>
            {available.length ? "Ou instalar direto pelo navegador" : "Instalar agora"}
          </button>
        )}

        <ol className="mt-6 space-y-3">
          {info.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-on-primary">{i + 1}</span>
              <span className="pt-1">{s}</span>
            </li>
          ))}
        </ol>
        {info.browserSteps && <p className="mt-4 text-sm text-muted">Sem baixar arquivo: {info.browserSteps.join(" ")}</p>}
        {info.note && <p className="mt-4 text-sm text-muted">{info.note}</p>}
        {available.length > 0 && (
          <details className="mt-4 text-xs text-muted">
            <summary className="cursor-pointer">Verificar o arquivo (SHA-256)</summary>
            <ul className="mt-2 space-y-1 break-all font-mono">
              {available.map((f) => <li key={f.file}>{f.file}: {files[f.file].sha256}</li>)}
            </ul>
          </details>
        )}
      </div>

      <div className="space-y-6">
        {!mobile && (
          <div className="flex items-center gap-5 rounded-3xl border border-line bg-card p-6 shadow-soft">
            <div className="size-36 shrink-0 rounded-2xl bg-white p-2" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <div>
              <h2 className="text-lg font-semibold">No celular ou tablet</h2>
              <p className="mt-1 text-sm text-muted">Aponte a câmera para o código: a página de download abre no aparelho com o instalador certo.</p>
            </div>
          </div>
        )}
        <div className="rounded-3xl border border-line bg-card p-6 shadow-soft">
          <h2 className="mb-3 text-lg font-semibold">Todos os sistemas</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(PLATFORMS) as PlatformKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setSelected(k)}
                aria-pressed={selected === k}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-3 text-sm font-medium ${selected === k ? "border-primary bg-surface text-primary" : "border-line hover:bg-surface"}`}
              >
                <PlatformIcon d={PLATFORMS[k].icon} className="size-5" />
                {PLATFORMS[k].name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
