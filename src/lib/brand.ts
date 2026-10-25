import { z } from "zod";
import { db } from "./db";

// Marca própria do profissional. Começa vazia (visual genérico da profissão) e
// cada campo, quando preenchido, substitui o padrão: o profissional decide
// quanto quer personalizar.

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida.");
const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());

export const BACKGROUNDS = {
  profession: "Imagem da minha profissão",
  library: "Imagem da galeria",
  custom: "Minha própria imagem",
  none: "Sem imagem (fundo liso)",
} as const;

export const FONTS = {
  classica: { label: "Clássica", sample: "Serifada, acolhedora" },
  moderna: { label: "Moderna", sample: "Limpa, direta" },
  elegante: { label: "Elegante", sample: "Sofisticada, editorial" },
  amigavel: { label: "Amigável", sample: "Arredondada, leve" },
} as const;

export const CORNERS = {
  reto: { label: "Retos", sample: "Sóbrio, institucional", xl: ".3rem", x2: ".4rem", x3: ".55rem" },
  suave: { label: "Suaves", sample: "Equilibrado (padrão)", xl: "1rem", x2: "1.25rem", x3: "1.5rem" },
  arredondado: { label: "Arredondados", sample: "Acolhedor, moderno", xl: "1.4rem", x2: "1.8rem", x3: "2.25rem" },
} as const;

/** Paletas prontas (cor principal e secundária) para começar rápido. */
export const PALETTES = [
  { name: "Oceano", primary: "#1f4e5a", accent: "#c8643b" },
  { name: "Floresta", primary: "#2f5d3a", accent: "#b88a2e" },
  { name: "Terracota", primary: "#a4532f", accent: "#2f5f6b" },
  { name: "Ameixa", primary: "#5b2a5e", accent: "#d08a3c" },
  { name: "Grafite", primary: "#2b2f36", accent: "#3a7bd5" },
  { name: "Rosé", primary: "#9c3d5a", accent: "#6b8f71" },
  { name: "Céu", primary: "#1d5fa8", accent: "#f2a03d" },
  { name: "Lavanda", primary: "#5a4fa3", accent: "#2f9c8f" },
] as const;

export const SECTION_KEYS = { sobre: "Sobre", servicos: "Serviços", galeria: "Galeria de fotos", faq: "Perguntas frequentes", local: "Onde fica (mapa)", avaliacoes: "Avaliações" } as const;
export type SectionKey = keyof typeof SECTION_KEYS;
const DEFAULT_ORDER = Object.keys(SECTION_KEYS) as SectionKey[];
export const MAX_GALLERY = 8;

export const brandSchema = z.object({
  businessName: optionalText(80),
  tagline: optionalText(140),
  background: z.enum(Object.keys(BACKGROUNDS) as [keyof typeof BACKGROUNDS, ...(keyof typeof BACKGROUNDS)[]]).default("profession"),
  libraryThemeId: optionalText(40),
  primaryColor: hexColor.optional(),
  accentColor: hexColor.optional(),
  corners: z.enum(["reto", "suave", "arredondado"]).default("suave"),
  font: z.enum(Object.keys(FONTS) as [keyof typeof FONTS, ...(keyof typeof FONTS)[]]).default("classica"),
  glass: z.boolean().default(true),
  ctaLabel: optionalText(30),
  contacts: z
    .object({
      whatsapp: optionalText(30),
      instagram: optionalText(60),
      website: optionalText(200),
      email: optionalText(120),
      address: optionalText(200),
    })
    .default({}),
  sections: z
    .object({
      prices: z.boolean().default(true),
      reviews: z.boolean().default(true),
      specialties: z.boolean().default(true),
      nextSlots: z.boolean().default(true),
    })
    .default({}),
  /** Ordem das seções da página pública; seções que faltarem vão para o fim. */
  sectionOrder: z
    .array(z.enum(DEFAULT_ORDER as [SectionKey, ...SectionKey[]]))
    .default(DEFAULT_ORDER)
    .transform((o) => [...new Set([...o, ...DEFAULT_ORDER])]),
  faq: z.array(z.object({ q: z.string().trim().min(1).max(200), a: z.string().trim().min(1).max(1500) })).max(15).default([]),
  /** Mensagem mostrada ao cliente logo depois de agendar. */
  confirmationMessage: optionalText(600),
});

export type Brand = z.infer<typeof brandSchema>;

/** Marca salva (tolerante a dados antigos ou incompletos). */
export function parseBrand(raw: unknown): Brand {
  const r = brandSchema.safeParse(raw ?? {});
  return r.success ? r.data : brandSchema.parse({});
}

/** Nome que aparece para clientes: o da empresa, se houver, senão o do profissional. */
export const brandName = (pro: { displayName: string; brand: unknown }) => parseBrand(pro.brand).businessName ?? pro.displayName;

export const assetUrl = (professionalId: string, kind: string, updatedAt: Date) =>
  `/api/marca/${professionalId}/${kind}?v=${updatedAt.getTime()}`;

/** Links prontos dos contatos (só os preenchidos). */
export function contactLinks(c: Brand["contacts"]) {
  const digits = c.whatsapp?.replace(/\D/g, "");
  const ig = c.instagram?.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "");
  const site = c.website && (/^https?:\/\//.test(c.website) ? c.website : `https://${c.website}`);
  return [
    digits && { label: "WhatsApp", href: `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}` },
    ig && { label: `@${ig}`, href: `https://instagram.com/${ig}` },
    site && { label: site.replace(/^https?:\/\//, "").replace(/\/$/, ""), href: site },
    c.email && { label: c.email, href: `mailto:${c.email}` },
  ].filter(Boolean) as { label: string; href: string }[];
}

/** URL do logo do profissional, se ele enviou um. */
export async function logoUrl(professionalId: string) {
  const a = await db.brandAsset.findUnique({ where: { professionalId_kind: { professionalId, kind: "LOGO" } }, select: { updatedAt: true } });
  return a ? assetUrl(professionalId, "logo", a.updatedAt) : null;
}

/** Fotos da galeria do profissional, na ordem em que foram enviadas. */
export async function galleryOf(professionalId: string) {
  const rows = await db.brandAsset.findMany({
    where: { professionalId, kind: { startsWith: "GALLERY:" } },
    select: { kind: true, updatedAt: true, width: true, height: true },
    orderBy: { kind: "asc" },
  });
  return rows.map((r) => ({ key: r.kind.slice(8), url: assetUrl(professionalId, `foto-${r.kind.slice(8)}`, r.updatedAt), width: r.width, height: r.height }));
}
