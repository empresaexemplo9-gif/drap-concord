"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { requireProfessional } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { brandSchema, parseBrand, type Brand } from "@/lib/brand";
import { MAX_LOGO_UPLOAD, MAX_THEME_UPLOAD, processLogo, processThemeImage } from "@/lib/themes/process";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const back = (msg: string, ok = false): never => redirect(`/app/marca?${ok ? "ok" : "erro"}=${encodeURIComponent(msg)}`);

/** Só o dono da conta mexe na marca (equipe usa, mas não edita). */
async function owner() {
  const ctx = await requireProfessional();
  if (ctx.memberRole !== "OWNER") back("Só o titular da conta pode alterar a marca.");
  return ctx;
}

async function saveBrand(professional: { id: string; orgId: string; brand: unknown }, userId: string, patch: Partial<Brand>, action: string) {
  const parsed = brandSchema.safeParse({ ...parseBrand(professional.brand), ...patch });
  if (!parsed.success) back(parsed.error.issues[0].message);
  await db.professional.update({ where: { id: professional.id }, data: { brand: parsed.data as Prisma.InputJsonValue } });
  await audit({ orgId: professional.orgId, userId, action, entity: "Professional", entityId: professional.id });
  revalidatePath("/", "layout");
}

function upload(form: FormData, key: string) {
  const f = form.get(key);
  return f instanceof File && f.size > 0 ? f : null;
}

async function storeAsset(professionalId: string, kind: "LOGO" | "BACKGROUND", img: { data: Buffer; mime: string; width: number; height: number; palette?: unknown }) {
  const data = { data: img.data, mime: img.mime, width: img.width, height: img.height, palette: (img.palette ?? undefined) as Prisma.InputJsonValue | undefined };
  await db.brandAsset.upsert({ where: { professionalId_kind: { professionalId, kind } }, update: data, create: { professionalId, kind, ...data } });
}

export async function saveIdentity(form: FormData) {
  const { professional, user } = await owner();
  const logo = upload(form, "logo");
  if (logo) {
    if (logo.size > MAX_LOGO_UPLOAD) back("O logo pode ter no máximo 2 MB.");
    try {
      await storeAsset(professional.id, "LOGO", await processLogo(Buffer.from(await logo.arrayBuffer())));
    } catch (e) {
      back((e as Error).message || "Não foi possível ler o logo.");
    }
  } else if (form.get("removeLogo") === "on") {
    await db.brandAsset.deleteMany({ where: { professionalId: professional.id, kind: "LOGO" } });
  }
  await saveBrand(professional, user.id, { businessName: str(form, "businessName"), tagline: str(form, "tagline") }, "brand.identity");
  back("Identidade salva.", true);
}

export async function saveVisual(form: FormData) {
  const { professional, user } = await owner();
  let background = str(form, "background") as Brand["background"];
  const bg = upload(form, "backgroundImage");
  if (bg) {
    if (bg.size > MAX_THEME_UPLOAD) back("A imagem de fundo pode ter no máximo 4 MB.");
    try {
      await storeAsset(professional.id, "BACKGROUND", await processThemeImage(Buffer.from(await bg.arrayBuffer())));
    } catch (e) {
      back((e as Error).message || "Não foi possível ler a imagem.");
    }
    background = "custom";
  } else if (background === "custom" && !(await db.brandAsset.count({ where: { professionalId: professional.id, kind: "BACKGROUND" } }))) {
    back("Envie sua imagem de fundo para usar essa opção.");
  }
  const libraryThemeId = str(form, "libraryThemeId");
  if (background === "library" && !libraryThemeId) back("Escolha uma imagem da galeria.");
  await saveBrand(
    professional,
    user.id,
    {
      background,
      libraryThemeId: libraryThemeId || undefined,
      primaryColor: form.get("colorMode") === "custom" ? str(form, "primaryColor") : undefined,
      font: str(form, "font") as Brand["font"],
      glass: form.get("glass") === "on",
    },
    "brand.visual",
  );
  back("Visual salvo.", true);
}

export async function savePage(form: FormData) {
  const { professional, user } = await owner();
  await saveBrand(
    professional,
    user.id,
    {
      ctaLabel: str(form, "ctaLabel"),
      contacts: {
        whatsapp: str(form, "whatsapp"),
        instagram: str(form, "instagram"),
        website: str(form, "website"),
        email: str(form, "email"),
        address: parseBrand(professional.brand).contacts.address,
      },
      sections: {
        prices: form.get("prices") === "on",
        reviews: form.get("reviews") === "on",
        specialties: form.get("specialties") === "on",
        nextSlots: form.get("nextSlots") === "on",
      },
    },
    "brand.page",
  );
  back("Página salva.", true);
}

/** Volta ao visual genérico da profissão (apaga logo e fundo próprios). */
export async function resetBrand() {
  const { professional, user } = await owner();
  await db.brandAsset.deleteMany({ where: { professionalId: professional.id } });
  await db.professional.update({ where: { id: professional.id }, data: { brand: {} } });
  await audit({ orgId: professional.orgId, userId: user.id, action: "brand.reset", entity: "Professional", entityId: professional.id });
  revalidatePath("/", "layout");
  back("Marca restaurada para o padrão da profissão.", true);
}
