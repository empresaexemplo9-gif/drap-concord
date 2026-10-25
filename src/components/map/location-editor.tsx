"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { Place } from "@/lib/geo";

const MapView = dynamic(() => import("./map-view").then((m) => m.MapView), { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-2xl bg-surface" /> });

const input = "min-h-11 w-full rounded-xl border border-line bg-card px-3.5 py-2 text-base text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

/** Endereço do atendimento presencial: busca, escolhe no mapa e ajusta o pino. */
export function LocationEditor({ initial }: { initial: { address: string | null; lat: number | null; lng: number | null; radiusKm: number | null } }) {
  const [address, setAddress] = useState(initial.address ?? "");
  const [pos, setPos] = useState(initial.lat != null && initial.lng != null ? { lat: initial.lat, lng: initial.lng } : null);
  const [results, setResults] = useState<Place[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const search = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/geo?q=${encodeURIComponent(address)}`);
      const j = await r.json();
      if (!r.ok) setMsg(j.error ?? "Não foi possível buscar agora.");
      else if (!j.results.length) setMsg("Não encontramos esse endereço. Inclua número, bairro e cidade.");
      else if (j.results.length === 1) pick(j.results[0]);
      else setResults(j.results);
    } finally {
      setBusy(false);
    }
  };
  const pick = (p: Place) => {
    setPos({ lat: p.lat, lng: p.lng });
    setResults([]);
    setMsg("Local marcado. Se precisar, arraste o pino até a porta certa.");
  };

  return (
    <div className="space-y-3">
      <label htmlFor="address" className="block text-sm font-medium">Endereço do atendimento presencial</label>
      <div className="flex gap-2">
        <input
          id="address"
          name="address"
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            setPos(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
          placeholder="Rua, número, bairro, cidade"
          className={input}
          maxLength={200}
        />
        <button type="button" onClick={search} disabled={busy || address.trim().length < 3} className="min-h-11 shrink-0 rounded-xl border border-line px-4 text-sm font-semibold text-primary hover:bg-surface disabled:opacity-50">
          {busy ? "Buscando…" : "Buscar no mapa"}
        </button>
      </div>
      {results.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line" aria-label="Endereços encontrados">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button type="button" onClick={() => pick(r)} className="block min-h-11 w-full px-3 py-2 text-left text-sm hover:bg-surface">{r.label}</button>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className="text-sm text-muted" role="status">{msg}</p>}
      <input type="hidden" name="latitude" value={pos?.lat ?? ""} />
      <input type="hidden" name="longitude" value={pos?.lng ?? ""} />
      {pos && <MapView markers={[{ id: "eu", lat: pos.lat, lng: pos.lng, label: address || "Local de atendimento" }]} onMove={(lat, lng) => setPos({ lat, lng })} className="h-64" label="Local de atendimento no mapa" />}
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Atendo a domicílio até (km)</span>
        <input type="number" name="serviceRadiusKm" min={0} max={300} defaultValue={initial.radiusKm ?? ""} placeholder="Ex.: 15" className={`${input} max-w-40`} />
        <span className="mt-1 block text-xs text-muted">Usado na busca &ldquo;perto de mim&rdquo; para quem atende em casa. Em branco, só o local acima conta.</span>
      </label>
    </div>
  );
}
