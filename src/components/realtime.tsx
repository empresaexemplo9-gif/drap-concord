"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// Canal em tempo real da conta: uma conexão só (SSE) para a página inteira.
// Toca chamadas recebidas, mostra notificações na hora e entrega a
// sinalização para a tela da chamada.

export type RealtimeMessage = { type: string; data: Record<string, unknown> };
type Listener = (m: RealtimeMessage) => void;
type Ring = { roomId: string; title: string; kind: string; from: { id: string; name: string }; ringSeconds: number };
type Toast = { id: number; title: string; body: string; link: string | null };

/** Ponte do app Android (apps/android): avisos do sistema com o app em segundo plano. */
type AndroidBridge = { notify: (title: string, body: string, path: string) => void; askNotifications: () => void };
const android = () => (typeof window !== "undefined" ? (window as unknown as { ConcordAndroid?: AndroidBridge }).ConcordAndroid : undefined);

const Ctx = createContext<{ subscribe: (fn: Listener) => () => void; connected: boolean } | null>(null);

export function useRealtime(fn: Listener) {
  const ctx = useContext(Ctx);
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => ctx?.subscribe((m) => ref.current(m)), [ctx]);
  return ctx?.connected ?? false;
}

/** Toque de chamada gerado no próprio navegador (sem arquivo de áudio). */
function useRingtone() {
  const ctxRef = useRef<AudioContext | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    navigator.vibrate?.(0);
  }, []);
  const start = useCallback(() => {
    stop();
    try {
      const ctx = (ctxRef.current ??= new AudioContext());
      void ctx.resume();
      const beep = () => {
        const t = ctx.currentTime;
        for (const [f, at] of [[880, 0], [660, 0.18], [880, 0.6], [660, 0.78]] as const) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sine";
          o.frequency.value = f;
          g.gain.setValueAtTime(0, t + at);
          g.gain.linearRampToValueAtTime(0.18, t + at + 0.02);
          g.gain.linearRampToValueAtTime(0, t + at + 0.16);
          o.connect(g).connect(ctx.destination);
          o.start(t + at);
          o.stop(t + at + 0.18);
        }
        navigator.vibrate?.([400, 200, 400]);
      };
      beep();
      timer.current = setInterval(beep, 2400);
    } catch {
      // Sem áudio liberado pelo navegador: a tela de chamada continua aparecendo.
    }
  }, [stop]);
  useEffect(() => stop, [stop]);
  return { start, stop };
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const listeners = useRef(new Set<Listener>());
  const [connected, setConnected] = useState(false);
  const [ring, setRing] = useState<Ring | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const ringtone = useRingtone();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const subscribe = useCallback((fn: Listener) => {
    listeners.current.add(fn);
    return () => void listeners.current.delete(fn);
  }, []);

  const dismissRing = useCallback(() => {
    ringtone.stop();
    setRing(null);
  }, [ringtone]);

  useEffect(() => {
    android()?.askNotifications();
    const es = new EventSource("/api/tempo-real");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (ev) => {
      let m: RealtimeMessage;
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      listeners.current.forEach((fn) => fn(m));
      const d = m.data;
      if (m.type === "call.ring") {
        const r = d as unknown as Ring;
        if (pathRef.current === `/chamadas/${r.roomId}`) return; // já está na sala
        setRing(r);
        ringtone.start();
        if (document.hidden && android()) android()!.notify(`${r.from.name} está te chamando`, r.title, `/chamadas/${r.roomId}?atender=1`);
        else if (document.hidden && "Notification" in window && Notification.permission === "granted") {
          const n = new Notification(`${r.from.name} está te chamando`, { body: r.title, tag: `call-${r.roomId}`, requireInteraction: true });
          n.onclick = () => {
            window.focus();
            router.push(`/chamadas/${r.roomId}?atender=1`);
          };
        }
      } else if (m.type === "call.cancel" || m.type === "call.ended") {
        setRing((cur) => {
          if (cur && cur.roomId === d.roomId) {
            ringtone.stop();
            return null;
          }
          return cur;
        });
      } else if (m.type === "notification") {
        if (String(d.title ?? "").endsWith("está te chamando")) return; // a tela de chamada já avisa
        const t: Toast = { id: Date.now() + Math.random(), title: String(d.title), body: String(d.body), link: (d.link as string) ?? null };
        if (document.hidden) android()?.notify(t.title, t.body, t.link ?? "/");
        setToasts((cur) => [...cur.slice(-2), t]);
        setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== t.id)), 7000);
        // Atualiza o sino e listas sem recarregar a página.
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(() => {
          if (!pathRef.current.startsWith("/chamadas/")) router.refresh();
        }, 400);
      }
    };
    return () => es.close();
  }, [router, ringtone]);

  // Chamada não atendida para de tocar sozinha.
  useEffect(() => {
    if (!ring) return;
    const t = setTimeout(dismissRing, ring.ringSeconds * 1000);
    return () => clearTimeout(t);
  }, [ring, dismissRing]);

  const answer = () => {
    if (!ring) return;
    dismissRing();
    router.push(`/chamadas/${ring.roomId}?atender=1`);
  };
  const reject = () => {
    if (!ring) return;
    void fetch(`/api/chamadas/${ring.roomId}`, { method: "POST", body: JSON.stringify({ action: "decline" }) });
    dismissRing();
  };

  return (
    <Ctx.Provider value={{ subscribe, connected }}>
      {children}
      {ring && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="ring-title" className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-3xl bg-card p-6 text-center shadow-soft">
            <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-primary text-3xl font-semibold text-on-primary motion-safe:animate-pulse">
              {ring.from.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </div>
            <p className="text-sm text-muted">{ring.kind === "VIDEO" ? "Chamada de vídeo" : "Chamada de áudio"}</p>
            <h2 id="ring-title" className="mt-1 text-2xl font-semibold">{ring.from.name}</h2>
            <p className="mt-1 text-sm text-muted">{ring.title}</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button onClick={reject} className="min-h-14 rounded-2xl bg-danger font-semibold text-white">Recusar</button>
              <button onClick={answer} autoFocus className="min-h-14 rounded-2xl bg-[#1f9d55] font-semibold text-white">Atender</button>
            </div>
          </div>
        </div>
      )}
      <div aria-live="polite" className="pointer-events-none fixed right-4 top-4 z-[80] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto rounded-2xl border border-line bg-card p-4 shadow-soft">
            <p className="font-semibold">{t.title}</p>
            <p className="text-sm text-muted">{t.body}</p>
            {t.link && (
              <button onClick={() => router.push(t.link!)} className="mt-2 text-sm font-semibold text-primary">Abrir</button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
