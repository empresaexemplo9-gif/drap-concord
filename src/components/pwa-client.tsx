"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "concord-install-dismissed";

function sessionStorageGet(k: string) {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
}

function sessionStorageSet(k: string, v: string) {
  try {
    sessionStorage.setItem(k, v);
  } catch {}
}

function safeGet(k: string) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

/** Registra o service worker, avisa sobre nova versão e oferece "Instalar app". */
export function PwaClient() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [update, setUpdate] = useState<ServiceWorker | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").then((reg) => {
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          sw?.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) setUpdate(sw);
          });
        });
      });
      // Recarrega só quando a pessoa pediu a atualização. Na primeira visita o
      // service worker assume a página (clients.claim) e não pode recarregar,
      // senão apaga o que já foi digitado nos formulários.
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (sessionStorageGet("concord-sw-update") === "1") {
          sessionStorageSet("concord-sw-update", "");
          location.reload();
        }
      });
    }
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const dismissed = safeGet(DISMISS_KEY) === "1";
    // Só oferece a instalação dentro da área logada, onde faz sentido.
    const inApp = location.pathname.startsWith("/app") || location.pathname.startsWith("/minha-conta");
    if (standalone || dismissed || !inApp) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) {
      setIos(true);
      setHidden(false);
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  return (
    <>
      {update && (
        <div className="fixed inset-x-4 top-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4 shadow-soft" role="status">
          <p className="text-sm">Tem uma versão nova do app.</p>
          <button className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary" onClick={() => {
              sessionStorageSet("concord-sw-update", "1");
              update.postMessage("SKIP_WAITING");
            }}>
            Atualizar
          </button>
        </div>
      )}
      {!hidden && (installEvent || ios) && (
        <div className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-md rounded-2xl border border-line bg-card p-4 shadow-soft md:bottom-6" role="dialog" aria-label="Instalar app">
          <p className="font-serif text-base font-semibold">Instale o Concord no seu aparelho</p>
          <p className="mt-1 text-sm text-muted">
            {ios ? "Toque em Compartilhar e depois em “Adicionar à Tela de Início”." : "Abra mais rápido e receba lembretes, mesmo com o navegador fechado."}
          </p>
          <div className="mt-3 flex gap-2">
            {installEvent && (
              <button
                className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary"
                onClick={async () => {
                  await installEvent.prompt();
                  setHidden(true);
                }}
              >
                Instalar app
              </button>
            )}
            <button className="min-h-11 rounded-xl px-4 text-sm font-semibold text-primary" onClick={dismiss}>
              Agora não
            </button>
          </div>
        </div>
      )}
    </>
  );
}
