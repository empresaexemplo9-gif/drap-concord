"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { requireUser, startActAs } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { parseProfileConfig } from "@/lib/profiles/schema";
import { slugify } from "@/lib/format";
import { MAX_THEME_UPLOAD, processThemeImage } from "@/lib/themes/process";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const admin = () => requireUser(["PLATFORM_ADMIN"]);

async function uniqueKey(base: string) {
  let key = slugify(base) || "perfil";
  for (let i = 2; await db.professionProfile.findUnique({ where: { key } }); i++) key = `${slugify(base)}-${i}`;
  return key;
}

export async function createProfile(form: FormData) {
  const user = await admin();
  const name = str(form, "name");
  if (!name) redirect("/admin/perfis?erro=Informe o nome da profissão.");
  const template = await db.professionProfile.findUniqueOrThrow({ where: { key: "personalizado" } });
  const p = await db.professionProfile.create({
    data: { key: await uniqueKey(name), name, status: "DRAFT", version: 0, config: template.config as Prisma.InputJsonValue },
  });
  await audit({ userId: user.id, action: "profile.created", entity: "ProfessionProfile", entityId: p.id });
  redirect(`/admin/perfis/${p.id}`);
}

export async function duplicateProfile(form: FormData) {
  const user = await admin();
  const src = await db.professionProfile.findUniqueOrThrow({ where: { id: str(form, "id") } });
  const name = `${src.name} (cópia)`;
  const p = await db.professionProfile.create({
    data: { key: await uniqueKey(name), name, status: "DRAFT", version: 0, config: src.config as Prisma.InputJsonValue },
  });
  await audit({ userId: user.id, action: "profile.duplicated", entity: "ProfessionProfile", entityId: p.id, meta: { from: src.id } });
  redirect(`/admin/perfis/${p.id}`);
}

// Um botão = uma ação (o valor do botão clicado não chega de forma confiável).
export async function saveProfileDraft(form: FormData) {
  return saveProfile(form, "save");
}

export async function sendProfileToReview(form: FormData) {
  return saveProfile(form, "review");
}

export async function publishProfile(form: FormData) {
  return saveProfile(form, "publish");
}

async function saveProfile(form: FormData, intent: "save" | "review" | "publish") {
  const user = await admin();
  const id = str(form, "id");
  let json: unknown;
  try {
    json = JSON.parse(str(form, "config"));
  } catch (e) {
    redirect(`/admin/perfis/${id}?erro=${encodeURIComponent(`JSON inválido: ${(e as Error).message}`)}`);
  }
  const parsed = parseProfileConfig(json);
  if (!parsed.success) {
    const msg = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`).join(" | ");
    redirect(`/admin/perfis/${id}?erro=${encodeURIComponent(msg)}`);
  }
  const current = await db.professionProfile.findUniqueOrThrow({ where: { id } });
  const name = str(form, "name") || current.name;
  const config = parsed.data as unknown as Prisma.InputJsonValue;

  if (intent === "publish") {
    const version = current.version + 1;
    await db.$transaction([
      db.professionProfile.update({ where: { id }, data: { name, config, status: "PUBLISHED", version } }),
      db.profileVersion.create({ data: { profileId: id, version, config } }),
    ]);
    await audit({ userId: user.id, action: "profile.published", entity: "ProfessionProfile", entityId: id, meta: { version } });
    redirect(`/admin/perfis/${id}?ok=publicado`);
  }
  await db.professionProfile.update({
    where: { id },
    data: { name, config, ...(intent === "review" ? { status: "REVIEW" } : current.status === "PUBLISHED" ? {} : { status: "DRAFT" }) },
  });
  await audit({ userId: user.id, action: `profile.${intent}`, entity: "ProfessionProfile", entityId: id });
  redirect(`/admin/perfis/${id}?ok=${intent === "review" ? "revisao" : "salvo"}`);
}

export async function unpublishProfile(form: FormData) {
  const user = await admin();
  const id = str(form, "id");
  await db.professionProfile.update({ where: { id }, data: { status: "DRAFT" } });
  await audit({ userId: user.id, action: "profile.unpublished", entity: "ProfessionProfile", entityId: id });
  redirect(`/admin/perfis/${id}?ok=despublicado`);
}

export async function moderateReview(form: FormData) {
  const user = await admin();
  await db.review.update({ where: { id: str(form, "id") }, data: { status: str(form, "decision") === "approve" ? "APPROVED" : "REJECTED" } });
  await audit({ userId: user.id, action: "review.moderated", entity: "Review", entityId: str(form, "id") });
  revalidatePath("/admin/moderacao");
}

export async function verifyRegistry(form: FormData) {
  const user = await admin();
  const verified = str(form, "decision") === "approve";
  await db.professional.update({ where: { id: str(form, "id") }, data: { registryVerified: verified } });
  await audit({ userId: user.id, action: "registry.verified", entity: "Professional", entityId: str(form, "id"), meta: { verified } });
  revalidatePath("/admin/moderacao");
}

export async function viewAs(form: FormData) {
  const user = await admin();
  const target = await db.user.findUnique({ where: { id: str(form, "userId") } });
  if (!target) redirect("/admin/ver-como");
  await startActAs(target.id);
  await audit({ userId: user.id, action: "admin.view_as.start", entity: "User", entityId: target.id });
  redirect(target.role === "CLIENT" ? "/minha-conta" : target.role === "PLATFORM_ADMIN" ? "/admin/perfis" : "/app");
}

// ---------- Temas das profissões ----------

async function readUpload(form: FormData, back: string) {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) redirect(`${back}?erro=${encodeURIComponent("Escolha uma imagem.")}`);
  if (file.size > MAX_THEME_UPLOAD) redirect(`${back}?erro=${encodeURIComponent("A imagem pode ter no máximo 4 MB.")}`);
  try {
    return await processThemeImage(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    redirect(`${back}?erro=${encodeURIComponent((e as Error).message || "Não foi possível ler a imagem.")}`);
  }
}

async function assignProfiles(themeId: string, profileIds: string[]) {
  await db.$transaction([
    db.professionProfile.updateMany({ where: { themeId, id: { notIn: profileIds } }, data: { themeId: null } }),
    db.professionProfile.updateMany({ where: { id: { in: profileIds } }, data: { themeId } }),
  ]);
}

export async function createTheme(form: FormData) {
  const user = await admin();
  const name = str(form, "name");
  if (!name) redirect(`/admin/temas?erro=${encodeURIComponent("Dê um nome ao tema.")}`);
  if (await db.professionTheme.findUnique({ where: { name } })) redirect(`/admin/temas?erro=${encodeURIComponent("Já existe um tema com esse nome.")}`);
  const img = await readUpload(form, "/admin/temas");
  const theme = await db.professionTheme.create({ data: { name, ...img!, palette: img!.palette } });
  await assignProfiles(theme.id, form.getAll("profiles").map(String));
  await audit({ userId: user.id, action: "theme.created", entity: "ProfessionTheme", entityId: theme.id });
  redirect("/admin/temas?ok=criado");
}

export async function updateTheme(form: FormData) {
  const user = await admin();
  const id = str(form, "id");
  const file = form.get("file");
  const data: Prisma.ProfessionThemeUpdateInput = { name: str(form, "name") || undefined };
  if (file instanceof File && file.size > 0) {
    const img = await readUpload(form, "/admin/temas");
    Object.assign(data, { ...img!, palette: img!.palette });
  }
  await db.professionTheme.update({ where: { id }, data });
  await assignProfiles(id, form.getAll("profiles").map(String));
  await audit({ userId: user.id, action: "theme.updated", entity: "ProfessionTheme", entityId: id });
  redirect("/admin/temas?ok=salvo");
}

export async function deleteTheme(form: FormData) {
  const user = await admin();
  const id = str(form, "id");
  await db.professionTheme.delete({ where: { id } });
  await audit({ userId: user.id, action: "theme.deleted", entity: "ProfessionTheme", entityId: id });
  redirect("/admin/temas?ok=excluido");
}
