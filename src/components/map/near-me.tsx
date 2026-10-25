"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MapMarker } from "./map-view";

const MapView = dynamic(() => import("./map-view").then((m) => m.MapView), { ssr: false, loading: () => <div className="h-[60vh] animate-pulse rounded-2xl bg-surface" /> });

/** "Perto de mim": usa a localização do aparelho (arredondada, ~100 m) para buscar por distância. */
export function NearMeButton({ basePath, params }: { basePath: string; params: Record<string, string> }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const go = () => {
    if (!navigator.geolocation) return setState("error");
    setState("busy");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const q = new URLSearchParams({ ...params, lat: p.coords.latitude.toFixed(3), lng: p.coords.longitude.toFixed(3), raio: params.raio ?? "15" });
        router.push(`${basePath}?${q}`);
      },
      () => setState("error"),
      { timeout: 10_000, maximumAge: 300_000 },
    );
  };
  return (
    <button type="button" onClick={go} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-card px-4 text-sm font-semibold text-primary hover:border-primary">
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
      {state === "busy" ? "Localizando…" : state === "error" ? "Permita a localização e tente de novo" : "Perto de mim"}
    </button>
  );
}

export function ResultsMap({ markers, user }: { markers: MapMarker[]; user: { lat: number; lng: number } | null }) {
  return <MapView markers={markers} user={user} zoom={14} className="h-[60vh]" label="Profissionais no mapa" />;
}
