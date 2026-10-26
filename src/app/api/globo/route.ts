import { db } from "@/lib/db";
import { parseBrand } from "@/lib/brand";
import { publishedProfiles } from "@/lib/profiles/registry";

// Profissionais com local de atendimento presencial, em GeoJSON, para o globo
// de exploração. Só dados que já são públicos na página de cada profissional.
export const dynamic = "force-dynamic";

export async function GET() {
  const [pros, profiles] = await Promise.all([
    db.professional.findMany({
      where: { isPublic: true, latitude: { not: null }, longitude: { not: null }, services: { some: { active: true, modality: { not: "ONLINE" } } }, user: { isSandbox: false } },
      select: { id: true, slug: true, displayName: true, brand: true, city: true, profileId: true, headline: true, latitude: true, longitude: true, serviceRadiusKm: true },
      take: 2000,
    }),
    publishedProfiles(),
  ]);
  const features = pros.map((p) => {
    const brand = parseBrand(p.brand);
    const profile = profiles.find((x) => x.id === p.profileId);
    return {
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [p.longitude!, p.latitude!] },
      properties: {
        id: p.id,
        slug: p.slug,
        name: brand.businessName ?? p.displayName,
        person: brand.businessName ? p.displayName : null,
        category: profile?.config.category ?? "",
        profession: profile?.name ?? "",
        headline: p.headline,
        city: p.city,
        color: brand.primaryColor ?? null,
        homeKm: p.serviceRadiusKm,
      },
    };
  });
  return Response.json({ type: "FeatureCollection", features }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
