import { getUser } from "@/lib/auth";
import { iceServers } from "@/lib/calls";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getUser())) return Response.json({ error: "Não autenticado" }, { status: 401 });
  return Response.json({ iceServers: await iceServers() }, { headers: { "Cache-Control": "private, no-store" } });
}
