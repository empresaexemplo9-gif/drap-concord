import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { publishedProfiles } from "./profiles/registry";
import { availableSlots } from "./booking";

export type SearchParams = { q?: string; cidade?: string; categoria?: string; modalidade?: string; precoMax?: string; disponivel?: string };

export async function searchProfessionals(p: SearchParams) {
  const profiles = await publishedProfiles();
  const profileIds = p.categoria ? profiles.filter((x) => x.config.category === p.categoria).map((x) => x.id) : undefined;
  const q = p.q?.trim();
  const priceMax = p.precoMax ? Math.round(Number(p.precoMax) * 100) : undefined;

  const where: Prisma.ProfessionalWhereInput = {
    isPublic: true,
    ...(profileIds ? { profileId: { in: profileIds } } : {}),
    ...(p.cidade ? { city: { contains: p.cidade.trim(), mode: "insensitive" } } : {}),
    ...(q
      ? {
          OR: [
            { displayName: { contains: q, mode: "insensitive" } },
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
    },
    take: 50,
  });

  const withExtras = await Promise.all(
    pros.map(async (pro) => {
      const first = pro.services[0];
      const next = first ? (await availableSlots(pro.id, first.id, 14))[0] ?? null : null;
      const rating = pro.reviews.length ? pro.reviews.reduce((s, r) => s + r.rating, 0) / pro.reviews.length : null;
      const category = profiles.find((x) => x.id === pro.profileId)?.config.category ?? "";
      return { pro, next, rating, category };
    }),
  );
  const filtered = p.disponivel ? withExtras.filter((x) => x.next && x.next.getTime() - Date.now() < 7 * 86_400_000) : withExtras;
  return filtered.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
}
