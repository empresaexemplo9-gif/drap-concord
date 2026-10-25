"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";

// Mapa da plataforma (Leaflet + OpenStreetMap/CARTO, sem chave de API). Pinos
// na cor da marca; claro ou escuro conforme o tema. Com `onMove`, o pino pode
// ser arrastado para ajustar o local exato.

export type MapMarker = { id: string; lat: number; lng: number; label: string; href?: string };

const TILES = {
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
};
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function MapView({
  markers,
  user,
  zoom = 15,
  onMove,
  className = "h-72",
  label = "Mapa",
}: {
  markers: MapMarker[];
  user?: { lat: number; lng: number } | null;
  zoom?: number;
  onMove?: (lat: number, lng: number) => void;
  className?: string;
  label?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<Marker[]>([]);
  const moveRef = useRef(onMove);
  moveRef.current = onMove;
  const key = JSON.stringify([markers.map((m) => [m.id, m.lat, m.lng]), user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      if (!map.current) {
        const dark = document.documentElement.dataset.theme === "dark";
        map.current = L.map(el.current, { scrollWheelZoom: false, attributionControl: true }).setView([markers[0]?.lat ?? -15.78, markers[0]?.lng ?? -47.93], markers.length ? zoom : 4);
        L.tileLayer(dark ? TILES.dark : TILES.light, { attribution: ATTRIBUTION, maxZoom: 19, subdomains: "abcd" }).addTo(map.current);
      }
      const m = map.current;
      layer.current.forEach((x) => x.remove());
      const pin = (cls: string) => L.divIcon({ className: "", html: `<span class="${cls}"></span>`, iconSize: [28, 36], iconAnchor: [14, 34], popupAnchor: [0, -30] });
      layer.current = markers.map((p) => {
        const mk = L.marker([p.lat, p.lng], { icon: pin("concord-pin"), draggable: !!moveRef.current, title: p.label, keyboard: true }).addTo(m);
        mk.bindPopup(p.href ? `<a href="${escape(p.href)}"><strong>${escape(p.label)}</strong></a>` : `<strong>${escape(p.label)}</strong>`);
        if (moveRef.current) mk.on("dragend", () => {
          const ll = mk.getLatLng();
          moveRef.current?.(ll.lat, ll.lng);
        });
        return mk;
      });
      if (user) layer.current.push(L.marker([user.lat, user.lng], { icon: L.divIcon({ className: "", html: '<span class="concord-me"></span>', iconSize: [18, 18], iconAnchor: [9, 9] }), title: "Você" }).addTo(m));
      const pts = [...markers.map((p) => [p.lat, p.lng] as [number, number]), ...(user ? [[user.lat, user.lng] as [number, number]] : [])];
      if (pts.length > 1) m.fitBounds(L.latLngBounds(pts), { padding: [36, 36], maxZoom: zoom });
      else if (pts.length === 1) m.setView(pts[0], zoom);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- redesenha quando os pontos mudam
  }, [key]);

  useEffect(
    () => () => {
      map.current?.remove();
      map.current = null;
    },
    [],
  );

  return <div ref={el} role="region" aria-label={label} className={`concord-map z-0 overflow-hidden rounded-2xl border border-line ${className}`} />;
}
