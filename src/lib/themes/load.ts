import { db } from "@/lib/db";
import type { Palette } from "./colors";

export type ThemeInfo = { id: string; name: string; palette: Palette; url: string };

const select = { id: true, name: true, palette: true, updatedAt: true } as const;

const toInfo = (t: { id: string; name: string; palette: unknown; updatedAt: Date }): ThemeInfo => ({
  id: t.id,
  name: t.name,
  palette: t.palette as Palette,
  url: `/api/temas/${t.id}?v=${t.updatedAt.getTime()}`,
});

/** Tema da profissão (sem carregar os bytes da imagem). */
export async function themeForProfile(profileId: string): Promise<ThemeInfo | null> {
  const profile = await db.professionProfile.findUnique({
    where: { id: profileId },
    select: { theme: { select } },
  });
  return profile?.theme ? toInfo(profile.theme) : null;
}

export async function allThemes() {
  const rows = await db.professionTheme.findMany({
    orderBy: { name: "asc" },
    select: { ...select, width: true, height: true, profiles: { select: { id: true, name: true } } },
  });
  return rows.map((r) => ({ ...toInfo(r), width: r.width, height: r.height, profiles: r.profiles }));
}

/**
 * Tema da conta logada: o da profissão do profissional (ou da organização,
 * para a equipe); para clientes, o do profissional do próximo atendimento ou,
 * sem agenda, o do vínculo mais recente.
 */
export async function themeForUser(user: { id: string; role: string; professional: { profileId: string } | null; memberships: { orgId: string }[] } | null) {
  if (!user) return null;
  if (user.professional) return themeForProfile(user.professional.profileId);
  if (user.memberships.length) {
    const pro = await db.professional.findFirst({ where: { orgId: { in: user.memberships.map((m) => m.orgId) } }, orderBy: { createdAt: "asc" }, select: { profileId: true } });
    return pro ? themeForProfile(pro.profileId) : null;
  }
  if (user.role !== "CLIENT") return null;
  const next = await db.appointment.findFirst({
    where: { client: { userId: user.id }, startsAt: { gte: new Date() }, status: { in: ["PENDING", "CONFIRMED"] } },
    orderBy: { startsAt: "asc" },
    select: { professional: { select: { profileId: true } } },
  });
  if (next) return themeForProfile(next.professional.profileId);
  const link = await db.client.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { org: { select: { professionals: { select: { profileId: true }, take: 1 } } } },
  });
  const profileId = link?.org.professionals[0]?.profileId;
  return profileId ? themeForProfile(profileId) : null;
}
