import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { getImpersonator, getUser } from "./auth";

/**
 * Quais páginas de profissional a pessoa pode abrir. Todo mundo vê as públicas;
 * páginas ocultas (prévias do admin, demonstrações, perfil desligado) abrem
 * para o admin no "Ver como" e para quem é da organização: a própria equipe
 * ou os clientes dela. Assim o profissional confere a própria página antes de
 * publicar e a demonstração mostra a página pública sem ir para a vitrine.
 */
export const proVisibility = cache(async (): Promise<Prisma.ProfessionalWhereInput> => {
  if (await getImpersonator()) return {};
  const user = await getUser();
  if (!user) return { isPublic: true };
  const clientOf = await db.client.findMany({ where: { userId: user.id }, select: { orgId: true } });
  const orgIds = [...new Set([...user.memberships.map((m) => m.orgId), ...clientOf.map((c) => c.orgId)])];
  return orgIds.length ? { OR: [{ isPublic: true }, { orgId: { in: orgIds } }] } : { isPublic: true };
});
