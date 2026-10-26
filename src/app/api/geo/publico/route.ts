import { headers } from "next/headers";
import { geocode } from "@/lib/geo";
import { rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Busca de lugares para o globo (visitantes também). Limite por endereço de rede
// para respeitar o uso justo do serviço de endereços do OpenStreetMap.
export async function GET(req: Request) {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`geo-publico:${ip}`, 20, 60_000)) return Response.json({ error: "Muitas buscas. Aguarde um pouco." }, { status: 429 });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return Response.json({ results: await geocode(q) });
}
