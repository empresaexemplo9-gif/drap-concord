import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

// Portabilidade (LGPD art. 18): exporta os dados do titular logado.
export async function GET() {
  const user = await getUser();
  if (!user || user.role !== "CLIENT") return new Response("Não autorizado", { status: 401 });
  const data = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      name: true, email: true, phone: true, createdAt: true,
      consents: { select: { purpose: true, textVersion: true, createdAt: true } },
      notifications: { select: { title: true, body: true, createdAt: true } },
      clients: {
        select: {
          name: true, email: true, phone: true, intake: true, createdAt: true,
          org: { select: { name: true } },
          appointments: { select: { startsAt: true, endsAt: true, status: true, modality: true, service: { select: { name: true, priceCents: true } } } },
        },
      },
    },
  });
  await audit({ userId: user.id, action: "lgpd.export", entity: "User", entityId: user.id });
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="meus-dados-concord.json"' },
  });
}
