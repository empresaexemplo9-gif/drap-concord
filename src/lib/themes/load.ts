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
