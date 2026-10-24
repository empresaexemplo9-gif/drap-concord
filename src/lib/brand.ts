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

export const brandSchema = z.object({
  businessName: optionalText(80),
  tagline: optionalText(140),
  background: z.enum(Object.keys(BACKGROUNDS) as [keyof typeof BACKGROUNDS, ...(keyof typeof BACKGROUNDS)[]]).default("profession"),
  libraryThemeId: optionalText(40),
  primaryColor: hexColor.optional(),
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
});

export type Brand = z.infer<typeof brandSchema>;

/** Marca salva (tolerante a dados antigos ou incompletos). */
export function parseBrand(raw: unknown): Brand {
  const r = brandSchema.safeParse(raw ?? {});
  return r.success ? r.data : brandSchema.parse({});
}

/** Nome que aparece para clientes: o da empresa, se houver, senão o do profissional. */
export const brandName = (pro: { displayName: string; brand: unknown }) => parseBrand(pro.brand).businessName ?? pro.displayName;

export const assetUrl = (professionalId: string, kind: "logo" | "fundo", updatedAt: Date) =>
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
