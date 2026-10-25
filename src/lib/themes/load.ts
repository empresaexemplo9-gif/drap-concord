import { db } from "@/lib/db";
import { assetUrl, parseBrand, type Brand } from "@/lib/brand";
import type { Palette, RGB } from "./colors";

/**
 * Visual aplicado à página. `url` nula = sem imagem de fundo; `palette` nula =
 * cores padrão da plataforma. `font` e `glass` vêm da marca do profissional.
 */
export type ThemeInfo = { id: string; name: string; palette: Palette | null; url: string | null; font?: Brand["font"]; glass?: boolean; accent?: RGB; corners?: Brand["corners"] };

const select = { id: true, name: true, palette: true, updatedAt: true } as const;

/** Tema da galeria (sempre com imagem e paleta). */
export type LibraryTheme = ThemeInfo & { palette: Palette; url: string };

const toInfo = (t: { id: string; name: string; palette: unknown; updatedAt: Date }): LibraryTheme => ({
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

const fromHex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;

/**
 * Visual do profissional: a marca dele decide o fundo (profissão, galeria,
 * imagem própria ou liso), a cor principal, a fonte e o efeito de vidro.
 * Sem personalização, é o tema da profissão.
 */
export async function themeForProfessional(pro: { id: string; profileId: string; brand: unknown }): Promise<ThemeInfo | null> {
  const brand = parseBrand(pro.brand);
  let base: ThemeInfo | null = null;
  if (brand.background === "custom") {
    const bg = await db.brandAsset.findUnique({ where: { professionalId_kind: { professionalId: pro.id, kind: "BACKGROUND" } }, select: { palette: true, updatedAt: true } });
    if (bg) base = { id: `brand-${pro.id}`, name: "Imagem própria", palette: bg.palette as Palette, url: assetUrl(pro.id, "fundo", bg.updatedAt) };
  } else if (brand.background === "library" && brand.libraryThemeId) {
    const t = await db.professionTheme.findUnique({ where: { id: brand.libraryThemeId }, select });
    if (t) base = toInfo(t);
  } else if (brand.background === "none") {
    base = { id: `plain-${pro.id}`, name: "Fundo liso", palette: null, url: null };
  }
  if (!base && brand.background !== "none") base = await themeForProfile(pro.profileId);
  base ??= { id: `plain-${pro.id}`, name: "Padrão", palette: null, url: null };

  const custom = brand.primaryColor ? fromHex(brand.primaryColor) : null;
  const palette: Palette | null = custom
    ? { average: base.palette?.average ?? [247, 242, 234], brightness: base.palette?.brightness ?? 0.9, vibrant: custom }
    : base.palette;
  return { ...base, palette, font: brand.font, glass: brand.glass, accent: brand.accentColor ? fromHex(brand.accentColor) : undefined, corners: brand.corners };
}

/**
 * Tema da conta logada: o da profissão do profissional (ou da organização,
 * para a equipe); para clientes, o do profissional do próximo atendimento ou,
 * sem agenda, o do vínculo mais recente.
 */
const proSelect = { id: true, profileId: true, brand: true } as const;

export async function themeForUser(user: { id: string; role: string; professional: { id: string; profileId: string; brand: unknown } | null; memberships: { orgId: string }[] } | null) {
  if (!user) return null;
  if (user.professional) return themeForProfessional(user.professional);
  if (user.memberships.length) {
    const pro = await db.professional.findFirst({ where: { orgId: { in: user.memberships.map((m) => m.orgId) } }, orderBy: { createdAt: "asc" }, select: proSelect });
    return pro ? themeForProfessional(pro) : null;
  }
  if (user.role !== "CLIENT") return null;
  const next = await db.appointment.findFirst({
    where: { client: { userId: user.id }, startsAt: { gte: new Date() }, status: { in: ["PENDING", "CONFIRMED"] } },
    orderBy: { startsAt: "asc" },
    select: { professional: { select: proSelect } },
  });
  if (next) return themeForProfessional(next.professional);
  const link = await db.client.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { org: { select: { professionals: { select: proSelect, take: 1 } } } },
  });
  const pro = link?.org.professionals[0];
  return pro ? themeForProfessional(pro) : null;
}
