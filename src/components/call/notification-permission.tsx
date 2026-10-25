"use client";

import { useEffect, useState } from "react";

/** Pede permissão para avisar chamadas mesmo com a aba em segundo plano. */
export function NotificationPermission() {
  const [state, setState] = useState<NotificationPermission | "unsupported" | null>(null);
  useEffect(() => setState("Notification" in window ? Notification.permission : "unsupported"), []);
  if (state !== "default") return null;
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4 text-sm">
      <span>Ative os avisos do navegador para saber de chamadas mesmo com a plataforma em outra aba.</span>
      <button onClick={async () => setState(await Notification.requestPermission())} className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-on-primary">Ativar avisos</button>
    </div>
  );
}
