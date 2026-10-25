import { getUser } from "@/lib/auth";
import { geocode } from "@/lib/geo";
import { rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Busca de endereço para o profissional marcar onde atende.
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
  if (!rateLimit(`geo:${user.id}`, 30, 60_000)) return Response.json({ error: "Muitas buscas. Aguarde um pouco." }, { status: 429 });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return Response.json({ results: await geocode(q) });
}
