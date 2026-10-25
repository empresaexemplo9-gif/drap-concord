import "server-only";

// Endereços e distâncias para o atendimento presencial. Geocodificação pelo
// OpenStreetMap (Nominatim): gratuita, sem chave, com limite de uso; por isso só
// é chamada quando alguém busca um endereço, nunca a cada visita.

export type Place = { label: string; lat: number; lng: number };

const UA = "DRAP Concord (agenda de atendimentos; https://drap-concord.vercel.app)";

/** Geocodificador simulado (desenvolvimento e testes sem acesso à internet). */
function fakeGeocode(q: string): Place[] {
  let h = 0;
  for (const c of q) h = (h * 31 + c.charCodeAt(0)) | 0;
  const lat = -23.55 + ((h % 1000) / 1000) * 0.1;
  const lng = -46.63 + (((h >> 10) % 1000) / 1000) * 0.1;
  return [{ label: `${q} (aprox.)`, lat, lng }];
}

export async function geocode(q: string): Promise<Place[]> {
  const query = q.trim().slice(0, 200);
  if (query.length < 3) return [];
  if (process.env.GEOCODER_FAKE === "1") return fakeGeocode(query);
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=0&limit=5&countrycodes=br&accept-language=pt-BR&q=${encodeURIComponent(query)}`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, next: { revalidate: 86_400 } });
    if (!r.ok) return [];
    const rows = (await r.json()) as { display_name: string; lat: string; lon: string }[];
    return rows.map((x) => ({ label: x.display_name, lat: Number(x.lat), lng: Number(x.lon) }));
  } catch {
    return [];
  }
}

/** Distância em km entre dois pontos (fórmula de haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const formatKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km < 10 ? km.toFixed(1).replace(".", ",") : Math.round(km)} km`);
