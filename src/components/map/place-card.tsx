"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const MapView = dynamic(() => import("./map-view").then((m) => m.MapView), { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-2xl bg-surface" /> });

const rad = (d: number) => (d * Math.PI) / 180;
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Onde o atendimento presencial acontece: mapa, endereço, como chegar e distância. */
export function PlaceCard({ name, address, lat, lng, links, radiusKm }: { name: string; address: string; lat: number; lng: number; links: { label: string; href: string }[]; radiusKm?: number | null }) {
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const locate = () => {
    if (!navigator.geolocation) return setMsg("Seu navegador não informa a localização.");
    setMsg("Buscando sua localização…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setMe({ lat: p.coords.latitude, lng: p.coords.longitude });
        setMsg(null);
      },
      () => setMsg("Não foi possível obter sua localização."),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };
  const d = me ? km(me, { lat, lng }) : null;
  return (
    <section aria-labelledby="onde-fica">
      <h2 id="onde-fica" className="mb-3 text-xl font-semibold">Onde fica</h2>
      <MapView markers={[{ id: "local", lat, lng, label: name }]} user={me} className="h-72" label={`Mapa: ${address}`} />
      <p className="mt-3 font-medium">📍 {address}</p>
      {radiusKm ? <p className="text-sm text-muted">Também atende a domicílio em até {radiusKm} km.</p> : null}
      {d != null && <p className="text-sm font-semibold text-primary">Fica a {d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1).replace(".", ",")} km`} de você.</p>}
      {msg && <p className="text-sm text-muted" role="status">{msg}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {links.map((l) => (
          <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-line bg-card px-4 text-sm font-semibold text-primary hover:bg-surface">{l.label}</a>
        ))}
        {!me && <button type="button" onClick={locate} className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-primary hover:bg-surface">Ver distância de mim</button>}
      </div>
    </section>
  );
}
