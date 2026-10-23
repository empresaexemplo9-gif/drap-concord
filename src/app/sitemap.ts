import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const pros = await db.professional.findMany({ where: { isPublic: true }, select: { slug: true } });
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    ...pros.map((p) => ({ url: `${base}/p/${p.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
