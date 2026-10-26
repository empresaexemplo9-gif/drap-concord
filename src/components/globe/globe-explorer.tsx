"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as GLMap, Marker, StyleSpecification } from "maplibre-gl";

// Globo de exploração da plataforma: a Terra em 3D girando no espaço, com os
// profissionais de atendimento presencial marcados onde atendem. De longe,
// imagens de satélite (NASA Blue Marble, domínio público); de perto, mapa de
// ruas (OpenStreetMap) e relevo em 3D (dados abertos de elevação). Implementação
// própria sobre o MapLibre GL (código aberto).

type Pro = { id: string; slug: string; name: string; person: string | null; category: string; profession: string; headline: string | null; city: string | null; color: string | null; homeKm: number | null };
type Feature = { type: "Feature"; geometry: { type: "Point"; coordinates: [number, number] }; properties: Pro };
type Place = { label: string; lat: number; lng: number };

const STYLE: StyleSpecification = {
  version: 8,
  projection: { type: "globe" },
  sources: {
    satelite: {
      type: "raster",
      tiles: ["https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg"],
      tileSize: 256,
      maxzoom: 8,
      attribution: "Imagens da Terra: NASA Blue Marble",
    },
    ruas: {
      type: "raster",
      tiles: ["a", "b", "c", "d"].map((s) => `https://${s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png`),
      tileSize: 256,
      maxzoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    relevo: {
      type: "raster-dem",
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      encoding: "terrarium",
      tileSize: 256,
      maxzoom: 14,
      attribution: "Relevo: Terrain Tiles (dados abertos)",
    },
  },
  layers: [
    // No globo, o fundo é a própria superfície: oceano enquanto as imagens carregam.
    { id: "oceano", type: "background", paint: { "background-color": "#173f63" } },
    // Satélite de longe, ruas de perto, com transição suave entre os dois.
    { id: "satelite", type: "raster", source: "satelite", paint: { "raster-opacity": ["interpolate", ["linear"], ["zoom"], 6, 1, 9, 0], "raster-fade-duration": 200 } },
    { id: "ruas", type: "raster", source: "ruas", minzoom: 5, paint: { "raster-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0, 9, 1] } },
    { id: "sombras", type: "hillshade", source: "relevo", minzoom: 7, paint: { "hillshade-exaggeration": 0.35, "hillshade-shadow-color": "#1f2a33" } },
  ],
  sky: {
    "sky-color": "#0b1d3a",
    "horizon-color": "#9cc8ff",
    "fog-color": "#cfe4ff",
    "sky-horizon-blend": 0.6,
    "horizon-fog-blend": 0.5,
    "fog-ground-blend": 0.6,
    "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 6, 1, 9, 0],
  },
};

const BRAND = "#1F4E5A";

export function GlobeExplorer() {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<GLMap | null>(null);
  const clusterMarkers = useRef(new Map<number, Marker>());
  const spinning = useRef(true);
  const [ready, setReady] = useState(false);
  const [webgl, setWebgl] = useState(true);
  const [pros, setPros] = useState<Feature[]>([]);
  const [visible, setVisible] = useState<Feature[]>([]);
  const [selected, setSelected] = useState<Feature | null>(null);
  const [q, setQ] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [spin, setSpin] = useState(true);
  const [terrain, setTerrain] = useState(false);
  const [center, setCenter] = useState<{ lat: number; lng: number; zoom: number }>({ lat: -14, lng: -52, zoom: 1.6 });

  const flyTo = useCallback((lng: number, lat: number, zoom = 13) => {
    spinning.current = false;
    setSpin(false);
    map.current?.flyTo({ center: [lng, lat], zoom, pitch: zoom > 10 ? 50 : 0, bearing: 0, duration: 4500, curve: 1.6, essential: true });
  }, []);

  // ---------- criação do globo ----------
  useEffect(() => {
    let cancelled = false;
    const canvas = document.createElement("canvas");
    if (!(canvas.getContext("webgl2") || canvas.getContext("webgl"))) {
      setWebgl(false);
      return;
    }
    (async () => {
      const ml = await import("maplibre-gl");
      if (cancelled || !box.current) return;
      const m = new ml.Map({
        container: box.current,
        style: STYLE,
        center: [-52, -14],
        zoom: 1.6,
        maxPitch: 75,
        attributionControl: { compact: true },
        canvasContextAttributes: { antialias: true },
      });
      map.current = m;
      m.addControl(new ml.NavigationControl({ visualizePitch: true, showCompass: true }), "top-right");
      m.addControl(new ml.GlobeControl(), "top-right");
      m.addControl(new ml.GeolocateControl({ positionOptions: { enableHighAccuracy: false }, fitBoundsOptions: { maxZoom: 13 }, trackUserLocation: false }), "top-right");
      m.addControl(new ml.ScaleControl({ unit: "metric" }), "bottom-left");

      m.on("load", async () => {
        const data = (await fetch("/api/globo").then((r) => r.json()).catch(() => ({ type: "FeatureCollection", features: [] }))) as { features: Feature[] };
        if (cancelled) return;
        setPros(data.features);
        m.addSource("profissionais", { type: "geojson", data: data as never, cluster: true, clusterRadius: 48, clusterMaxZoom: 11 });
        // Halo e ponto de cada profissional (na cor da marca dele, se houver).
        m.addLayer({ id: "pro-halo", type: "circle", source: "profissionais", filter: ["!", ["has", "point_count"]], paint: { "circle-radius": 13, "circle-color": "#ffffff", "circle-opacity": 0.9, "circle-pitch-alignment": "map" } });
        m.addLayer({ id: "pro", type: "circle", source: "profissionais", filter: ["!", ["has", "point_count"]], paint: { "circle-radius": 9, "circle-color": ["coalesce", ["get", "color"], BRAND], "circle-stroke-width": 2, "circle-stroke-color": "#ffffff", "circle-pitch-alignment": "map" } });
        m.addLayer({ id: "grupo", type: "circle", source: "profissionais", filter: ["has", "point_count"], paint: { "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 50, 30], "circle-color": BRAND, "circle-opacity": 0.92, "circle-stroke-width": 3, "circle-stroke-color": "#ffffff" } });

        m.on("click", "pro", (e) => {
          const f = e.features?.[0] as unknown as Feature | undefined;
          if (f) setSelected(pros0(data.features, f.properties.id));
        });
        m.on("click", "grupo", async (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const src = m.getSource("profissionais") as GeoJSONSource;
          const zoom = await src.getClusterExpansionZoom(f.properties!.cluster_id as number);
          m.easeTo({ center: (f.geometry as unknown as { coordinates: [number, number] }).coordinates, zoom: zoom + 0.5, duration: 1200 });
        });
        for (const id of ["pro", "grupo"]) {
          m.on("mouseenter", id, () => (m.getCanvas().style.cursor = "pointer"));
          m.on("mouseleave", id, () => (m.getCanvas().style.cursor = ""));
        }
        setReady(true);
        refresh();
      });

      // Números nos grupos (marcadores leves, sem depender de fontes externas).
      const refresh = () => {
        if (!m.getSource("profissionais")) return;
        const seen = new Set<number>();
        for (const f of m.querySourceFeatures("profissionais", { filter: ["has", "point_count"] })) {
          const id = f.properties!.cluster_id as number;
          if (seen.has(id)) continue;
          seen.add(id);
          let mk = clusterMarkers.current.get(id);
          if (!mk) {
            const el = document.createElement("span");
            el.className = "pointer-events-none text-sm font-bold text-white";
            el.textContent = String(f.properties!.point_count);
            mk = new ml.Marker({ element: el }).setLngLat((f.geometry as unknown as { coordinates: [number, number] }).coordinates).addTo(m);
            clusterMarkers.current.set(id, mk);
          }
        }
        for (const [id, mk] of clusterMarkers.current) {
          if (!seen.has(id)) {
            mk.remove();
            clusterMarkers.current.delete(id);
          }
        }
        // Lista acessível: profissionais visíveis na tela.
        const b = m.getBounds();
        setVisibleFrom(b);
        const c = m.getCenter();
        setCenter({ lat: c.lat, lng: c.lng, zoom: m.getZoom() });
      };
      const setVisibleFrom = (b: { contains: (ll: [number, number]) => boolean }) => setVisible((cur) => {
        const all = allRef.current;
        const next = m.getZoom() < 3 ? all : all.filter((f) => b.contains(f.geometry.coordinates));
        return next.length === cur.length && next.every((f, i) => f === cur[i]) ? cur : next;
      });
      m.on("moveend", refresh);
      m.on("sourcedata", (e) => e.sourceId === "profissionais" && e.isSourceLoaded && refresh());

      // Giro lento do globo enquanto ninguém mexe.
      const rotate = () => {
        if (spinning.current && m.getZoom() < 4 && !m.isMoving()) m.easeTo({ center: [m.getCenter().lng - 8, m.getCenter().lat], duration: 1000, easing: (t) => t });
      };
      m.on("moveend", () => spinning.current && rotate());
      m.on("load", () => setTimeout(rotate, 1200));
      const stop = () => {
        spinning.current = false;
        setSpin(false);
      };
      m.on("dragstart", stop);
      m.on("wheel", stop);
      m.on("touchstart", stop);
    })();
    const markers = clusterMarkers.current;
    return () => {
      cancelled = true;
      markers.forEach((mk) => mk.remove());
      map.current?.remove();
      map.current = null;
    };
  }, []);

  const allRef = useRef<Feature[]>([]);
  allRef.current = pros;

  const toggleSpin = () => {
    const next = !spin;
    setSpin(next);
    spinning.current = next;
    if (next && map.current) map.current.easeTo({ zoom: Math.min(map.current.getZoom(), 2.2), pitch: 0, duration: 1500 });
  };

  const toggleTerrain = () => {
    const m = map.current;
    if (!m) return;
    const next = !terrain;
    setTerrain(next);
    m.setTerrain(next ? { source: "relevo", exaggeration: 1.4 } : null);
    if (next && m.getPitch() < 40) m.easeTo({ pitch: 60, duration: 1200 });
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setPlaces([]);
    // Primeiro, profissionais com o nome digitado.
    const term = q.trim().toLowerCase();
    if (term.length < 2) return;
    const pro = pros.find((f) => `${f.properties.name} ${f.properties.person ?? ""} ${f.properties.profession}`.toLowerCase().includes(term));
    if (pro) {
      setSelected(pro);
      flyTo(pro.geometry.coordinates[0], pro.geometry.coordinates[1], 15);
      return;
    }
    const r = await fetch(`/api/geo/publico?q=${encodeURIComponent(q)}`);
    const j = await r.json().catch(() => ({ results: [] }));
    if (!r.ok) return setMsg(j.error ?? "Não foi possível buscar agora.");
    if (!j.results.length) return setMsg("Lugar não encontrado. Tente cidade, bairro ou endereço.");
    if (j.results.length === 1) {
      flyTo(j.results[0].lng, j.results[0].lat, 12);
      return;
    }
    setPlaces(j.results);
  };

  const sel = selected?.properties;
  const grouped = useMemo(() => visible.slice(0, 60), [visible]);

  if (!webgl) {
    return (
      <div className="gutter py-16 text-center">
        <h1 className="text-2xl font-semibold">Seu navegador não exibe o globo 3D</h1>
        <p className="mt-2 text-muted">Ative a aceleração gráfica (WebGL) ou use a busca por mapa na vitrine.</p>
        <a href="/vitrine?mapa=1" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-semibold text-on-primary">Ver no mapa</a>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100dvh-4.5rem)] min-h-[520px] overflow-hidden bg-[#0b1424]">
      {/* O MapLibre aplica position:relative ao contêiner; a posição fica no invólucro. */}
      <div className="absolute inset-0" role="region" aria-label="Globo 3D com profissionais" data-testid="globo" data-center={`${center.lat.toFixed(3)},${center.lng.toFixed(3)},${center.zoom.toFixed(1)}`} data-ready={ready ? "1" : "0"}>
        <div ref={box} className="h-full w-full" />
      </div>

      {/* Busca e ações */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-col gap-2 sm:left-4 sm:right-auto sm:w-[26rem]">
        <form onSubmit={search} role="search" className="pointer-events-auto flex gap-2 rounded-2xl border border-white/15 bg-[#0b1424]/80 p-2 text-white shadow-2xl backdrop-blur-md">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cidade, endereço ou profissional" aria-label="Buscar no globo" className="min-h-11 flex-1 rounded-xl bg-white/10 px-3 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/40" />
          <button className="min-h-11 rounded-xl bg-white px-4 font-semibold text-[#0b1424]">Ir</button>
        </form>
        {msg && <p role="status" className="pointer-events-auto rounded-xl bg-[#0b1424]/85 px-3 py-2 text-sm text-white">{msg}</p>}
        {places.length > 0 && (
          <ul className="pointer-events-auto overflow-hidden rounded-2xl border border-white/15 bg-[#0b1424]/90 text-sm text-white backdrop-blur-md" aria-label="Lugares encontrados">
            {places.map((p) => (
              <li key={`${p.lat},${p.lng}`}>
                <button onClick={() => { setPlaces([]); flyTo(p.lng, p.lat, 12); }} className="block min-h-11 w-full px-3 py-2 text-left hover:bg-white/10">{p.label}</button>
              </li>
            ))}
          </ul>
        )}
        <div className="pointer-events-auto flex flex-wrap gap-2">
          <button onClick={toggleSpin} aria-pressed={spin} className="min-h-10 rounded-full border border-white/20 bg-[#0b1424]/80 px-4 text-sm font-semibold text-white backdrop-blur-md">{spin ? "Parar o giro" : "Girar o globo"}</button>
          <button onClick={toggleTerrain} aria-pressed={terrain} className="min-h-10 rounded-full border border-white/20 bg-[#0b1424]/80 px-4 text-sm font-semibold text-white backdrop-blur-md">{terrain ? "Relevo 3D ligado" : "Relevo 3D"}</button>
          <button onClick={() => flyTo(-52, -14, 3.4)} className="min-h-10 rounded-full border border-white/20 bg-[#0b1424]/80 px-4 text-sm font-semibold text-white backdrop-blur-md">Brasil</button>
        </div>
      </div>

      {/* Profissional escolhido */}
      {sel && (
        <div className="absolute inset-x-3 bottom-3 z-10 rounded-3xl border border-line bg-card p-5 shadow-2xl sm:bottom-6 sm:left-4 sm:right-auto sm:w-[26rem]" role="dialog" aria-label={sel.name}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">{sel.category}</p>
              <h2 className="truncate text-xl font-semibold">{sel.name}</h2>
              <p className="text-sm text-muted">{[sel.person, sel.headline ?? sel.profession, sel.city].filter(Boolean).join(" · ")}</p>
              {sel.homeKm ? <p className="text-sm text-muted">Também atende a domicílio em até {sel.homeKm} km.</p> : null}
            </div>
            <button onClick={() => setSelected(null)} aria-label="Fechar" className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-surface">✕</button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`/p/${sel.slug}/agendar`} className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 font-semibold text-on-primary hover:bg-primary-hover">Agendar</a>
            <a href={`/p/${sel.slug}`} className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 font-semibold text-primary hover:bg-surface">Ver página</a>
            <button onClick={() => flyTo(selected!.geometry.coordinates[0], selected!.geometry.coordinates[1], 16.5)} className="inline-flex min-h-11 items-center rounded-xl px-3 font-semibold text-primary hover:bg-surface">Aproximar</button>
          </div>
        </div>
      )}

      {/* Lista acessível dos profissionais na área visível */}
      <aside className="absolute bottom-6 right-16 top-3 z-10 hidden w-80 flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#0b1424]/80 text-white shadow-2xl backdrop-blur-md lg:flex" aria-label="Profissionais nesta área">
        <h2 className="border-b border-white/10 px-4 py-3 font-semibold">
          {center.zoom < 3 ? "No mundo" : "Nesta área"} <span className="font-normal text-white/60">· {visible.length} profissional(is)</span>
        </h2>
        <ul className="flex-1 overflow-y-auto">
          {grouped.length === 0 && <li className="px-4 py-3 text-sm text-white/60">{ready ? "Ninguém aqui ainda. Afaste o zoom ou busque outro lugar." : "Carregando o globo…"}</li>}
          {grouped.map((f) => (
            <li key={f.properties.id}>
              <button
                onClick={() => {
                  setSelected(f);
                  flyTo(f.geometry.coordinates[0], f.geometry.coordinates[1], 15);
                }}
                className="block w-full px-4 py-3 text-left hover:bg-white/10"
              >
                <span className="block truncate font-semibold">{f.properties.name}</span>
                <span className="block truncate text-xs text-white/70">{[f.properties.profession, f.properties.city].filter(Boolean).join(" · ")}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function pros0(all: Feature[], id: string) {
  return all.find((f) => f.properties.id === id) ?? null;
}
