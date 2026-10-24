"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfessional } from "@/lib/auth";
import { db } from "@/lib/db";
import { tenant } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { createInvite } from "@/lib/invites";

/** Desativa o link geral atual e cria outro (o antigo para de funcionar). */
export async function regenerateGeneral() {
  const { orgId, professional, user } = await requireProfessional();
  await db.invite.updateMany({ where: { professionalId: professional.id, kind: "GENERAL", revokedAt: null }, data: { revokedAt: new Date() } });
  const inv = await createInvite({ orgId, professionalId: professional.id, createdById: user.id, kind: "GENERAL", label: "Link geral" });
  await audit({ orgId, userId: user.id, action: "invite.regenerated", entity: "Invite", entityId: inv.id });
  revalidatePath("/app/convites");
}

export async function revokeInvite(form: FormData) {
  const { orgId, user } = await requireProfessional();
  const id = String(form.get("id") ?? "");
  const { count } = await db.invite.updateMany({ where: { id, orgId, revokedAt: null }, data: { revokedAt: new Date() } });
  if (count) await audit({ orgId, userId: user.id, action: "invite.revoked", entity: "Invite", entityId: id });
  revalidatePath("/app/convites");
}

/** Convite pessoal: o cliente cria a conta já ligada à ficha existente. */
export async function invitePersonal(form: FormData) {
  const { orgId, professional, user } = await requireProfessional();
  const clientId = String(form.get("clientId") ?? "");
  const client = await tenant(orgId).clients.get(clientId);
  if (!client || client.userId) redirect(`/app/clientes/${clientId}`);
  await db.invite.updateMany({ where: { orgId, clientId, kind: "PERSONAL", revokedAt: null }, data: { revokedAt: new Date() } });
  const inv = await createInvite({ orgId, professionalId: professional.id, createdById: user.id, kind: "PERSONAL", clientId, label: client.name });
  await audit({ orgId, userId: user.id, action: "invite.created", entity: "Invite", entityId: inv.id });
  redirect(`/app/clientes/${clientId}#convite`);
}
