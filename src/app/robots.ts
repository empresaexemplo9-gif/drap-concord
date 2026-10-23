import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return {
    rules: { userAgent: "*", allow: ["/", "/p/"], disallow: ["/app", "/admin", "/minha-conta", "/api", "/onboarding"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
