import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { publishedProfiles } from "./profiles/registry";
import { availableSlots } from "./booking";
import { distanceKm } from "./geo";

export type SearchParams = { q?: string; cidade?: string; categoria?: string; modalidade?: string; precoMax?: string; disponivel?: string; lat?: string; lng?: string; raio?: string; mapa?: string };

/** Ponto de busca "perto de mim" (só se válido). */
export function searchPoint(p: SearchParams) {
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  if (!p.lat || !p.lng || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const raio = Math.min(200, Math.max(1, Number(p.raio) || 15));
  return { lat, lng, raio };
}

export async function searchProfessionals(p: SearchParams) {
  const profiles = await publishedProfiles();
  const profileIds = p.categoria ? profiles.filter((x) => x.config.category === p.categoria).map((x) => x.id) : undefined;
  const q = p.q?.trim();
  const priceMax = p.precoMax ? Math.round(Number(p.precoMax) * 100) : undefined;
  const near = searchPoint(p);

  const where: Prisma.ProfessionalWhereInput = {
    isPublic: true,
    ...(near ? { latitude: { not: null }, longitude: { not: null } } : {}),
    ...(profileIds ? { profileId: { in: profileIds } } : {}),
    ...(p.cidade ? { city: { contains: p.cidade.trim(), mode: "insensitive" } } : {}),
    ...(q
      ? {
          OR: [
            { displayName: { contains: q, mode: "insensitive" } },
            { brand: { path: ["businessName"], string_contains: q } },
            { headline: { contains: q, mode: "insensitive" } },
            { bio: { contains: q, mode: "insensitive" } },
            { specialties: { has: q } },
            { services: { some: { name: { contains: q, mode: "insensitive" }, active: true } } },
            { profile: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
    services: {
      some: {
        active: true,
        ...(p.modalidade ? { modality: p.modalidade as "ONLINE" } : {}),
        ...(priceMax !== undefined && !Number.isNaN(priceMax) ? { priceCents: { lte: priceMax } } : {}),
      },
    },
  };

  const pros = await db.professional.findMany({
    where,
    include: {
      profile: true,
      services: { where: { active: true }, orderBy: { priceCents: "asc" } },
      reviews: { where: { status: "APPROVED" }, select: { rating: true } },
      brandAssets: { where: { kind: "LOGO" }, select: { updatedAt: true } },
    },
    take: 50,
  });

  const withExtras = await Promise.all(
    pros.map(async (pro) => {
      const first = pro.services[0];
      const next = first ? (await availableSlots(pro.id, first.id, 14, new Date(), { client: true }))[0] ?? null : null;
      const rating = pro.reviews.length ? pro.reviews.reduce((s, r) => s + r.rating, 0) / pro.reviews.length : null;
      const category = profiles.find((x) => x.id === pro.profileId)?.config.category ?? "";
      const distance = near && pro.latitude != null && pro.longitude != null ? distanceKm(near, { lat: pro.latitude, lng: pro.longitude }) : null;
      return { pro, next, rating, category, distance };
    }),
  );
  let filtered = p.disponivel ? withExtras.filter((x) => x.next && x.next.getTime() - Date.now() < 7 * 86_400_000) : withExtras;
  if (near) {
    // Perto: o local fica dentro do raio, ou o profissional atende a domicílio até onde a pessoa está.
    filtered = filtered.filter((x) => x.distance != null && (x.distance <= near.raio || (x.pro.serviceRadiusKm != null && x.distance <= x.pro.serviceRadiusKm)));
    return filtered.sort((a, b) => a.distance! - b.distance!);
  }
  return filtered.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
}
