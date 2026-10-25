"use client";

import { useEffect, useState } from "react";

// Central de download do app: detecta o sistema e oferece a instalação com um
// toque (quando o navegador permite) ou o passo a passo daquele sistema.

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
export type PlatformKey = "android" | "iphone" | "ipad" | "windows" | "mac" | "linux" | "chromeos";
export type StoreLinks = { play?: string; appStore?: string; microsoft?: string };

const PLATFORMS: Record<PlatformKey, { name: string; device: string; icon: string; steps: string[]; note?: string }> = {
  android: {
    name: "Android",
    device: "Celulares e tablets Android",
    icon: "M7 4l1.5 2.5M17 4l-1.5 2.5M5 10a7 7 0 0 1 14 0v7H5zM9 13h.01M15 13h.01",
    steps: ["Abra esta página no Chrome, Edge ou Samsung Internet.", "Toque em Instalar app (ou no menu ⋮ → Instalar app).", "Pronto: o ícone do Concord aparece na tela inicial e na lista de apps."],
  },
  iphone: {
    name: "iPhone",
    device: "iOS 16.4 ou mais recente",
    icon: "M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2",
    steps: ["Abra esta página no Safari (ou Chrome).", "Toque em Compartilhar (quadrado com seta para cima).", "Escolha Adicionar à Tela de Início e toque em Adicionar."],
    note: "Para receber avisos de chamadas e lembretes, abra o Concord pelo ícone da tela de início e permita as notificações.",
  },
  ipad: {
    name: "iPad",
    device: "iPadOS 16.4 ou mais recente",
    icon: "M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2",
    steps: ["Abra esta página no Safari.", "Toque em Compartilhar no topo da tela.", "Escolha Adicionar à Tela de Início e toque em Adicionar."],
  },
  windows: {
    name: "Windows",
    device: "Windows 10 e 11",
    icon: "M3 5l8-1v8H3zM13 4l8-1v9h-8zM3 13h8v8l-8-1zM13 13h8v9l-8-1z",
    steps: ["Abra esta página no Edge ou no Chrome.", "Clique em Instalar (ou no ícone de instalar na barra de endereço).", "O Concord vira um app no menu Iniciar e na barra de tarefas."],
  },
  mac: {
    name: "macOS",
    device: "Mac (Intel e Apple Silicon)",
    icon: "M16 3c-1 .1-2.2.8-2.8 1.6-.6.7-1 1.8-.9 2.8 1 .1 2.2-.6 2.8-1.4.6-.8 1-1.9.9-3zM19 16.5c-.5 1.2-.8 1.7-1.4 2.7-.9 1.4-2.2 3.1-3.8 3.1-1.4 0-1.8-.9-3.7-.9s-2.3.9-3.7.9c-1.6 0-2.8-1.6-3.7-3-2.5-3.9-2.8-8.5-1.2-10.9 1.1-1.7 2.9-2.7 4.6-2.7s2.8.9 4.2.9c1.4 0 2.2-.9 4.2-.9 1.5 0 3.1.8 4.2 2.2-3.7 2-3.1 7.3.3 8.6z",
    steps: ["No Safari 17+: menu Arquivo → Adicionar ao Dock.", "No Chrome ou Edge: clique em Instalar (ícone na barra de endereço).", "O Concord abre em janela própria, como qualquer app do Mac."],
  },
  linux: {
    name: "Linux",
    device: "Ubuntu, Fedora, Debian e outros",
    icon: "M12 2c-2 0-3 2-3 4.5 0 1.5-.5 2.5-1.5 4S5 14 5 16c0 1 .5 2 1.5 2.5L6 21h12l-.5-2.5c1-.5 1.5-1.5 1.5-2.5 0-2-1.5-4-2.5-5.5S15 8 15 6.5C15 4 14 2 12 2z",
    steps: ["Abra esta página no Chrome, Chromium, Edge ou Brave.", "Clique em Instalar (ícone na barra de endereço).", "O Concord aparece no menu de aplicativos do sistema."],
    note: "O Firefox no computador não instala apps da web; use um dos navegadores acima.",
  },
  chromeos: {
    name: "ChromeOS",
    device: "Chromebooks",
    icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 8h9M8.5 14 4 6.3M15.5 14 11 21.9",
    steps: ["Abra esta página no Chrome.", "Clique em Instalar (ícone na barra de endereço).", "O Concord fica na estante e no inicializador de apps."],
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

function PlatformIcon({ d, className = "size-6" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d={d} />
    </svg>
  );
}

export function DownloadCenter({ stores, qrSvg }: { stores: StoreLinks; qrSvg: string }) {
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
  const storeFor: Partial<Record<PlatformKey, { href?: string; label: string }>> = {
    android: { href: stores.play, label: "Baixar no Google Play" },
    iphone: { href: stores.appStore, label: "Baixar na App Store" },
    ipad: { href: stores.appStore, label: "Baixar na App Store" },
    windows: { href: stores.microsoft, label: "Baixar na Microsoft Store" },
  };
  const store = storeFor[selected];

  return (
    <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
      <div className="rounded-3xl border border-line bg-card p-6 shadow-soft sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-surface text-primary"><PlatformIcon d={info.icon} /></span>
          <div>
            <p className="text-sm text-muted">{platform === selected ? "Seu aparelho" : "Instalar no"}</p>
            <h2 className="text-2xl font-semibold">{info.name}</h2>
          </div>
        </div>
        <p className="mt-1 text-sm text-muted">{info.device}</p>

        {installed && platform === selected ? (
          <p className="mt-6 rounded-2xl bg-success-bg p-4 font-semibold text-success">✓ O Concord já está instalado neste aparelho.</p>
        ) : (
          <div className="mt-6 flex flex-wrap gap-3">
            {prompt && platform === selected && (
              <button onClick={install} className="inline-flex min-h-14 items-center gap-2 rounded-2xl bg-primary px-7 text-lg font-semibold text-on-primary hover:bg-primary-hover">
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3" /></svg>
                Instalar agora
              </button>
            )}
            {store?.href && (
              <a href={store.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-14 items-center rounded-2xl border border-line px-6 font-semibold hover:bg-surface">{store.label}</a>
            )}
          </div>
        )}

        <ol className="mt-6 space-y-3">
          {info.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-on-primary">{i + 1}</span>
              <span className="pt-1">{s}</span>
            </li>
          ))}
        </ol>
        {info.note && <p className="mt-4 text-sm text-muted">{info.note}</p>}
      </div>

      <div className="space-y-6">
        {!mobile && (
          <div className="flex items-center gap-5 rounded-3xl border border-line bg-card p-6 shadow-soft">
            <div className="size-36 shrink-0 rounded-2xl bg-white p-2" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <div>
              <h2 className="text-lg font-semibold">No celular ou tablet</h2>
              <p className="mt-1 text-sm text-muted">Aponte a câmera para o código: a página de download abre no aparelho e mostra como instalar.</p>
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
