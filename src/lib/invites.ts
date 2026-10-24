import { randomBytes } from "node:crypto";
import { addDays } from "date-fns";
import { db } from "./db";
import { audit } from "./audit";
import { notify } from "./notify";

// Convites do profissional (Acesso 1) para clientes (Acesso 2) criarem a
// própria conta já ligada a ele.

export type InviteKind = "GENERAL" | "PERSONAL";

const newToken = () => randomBytes(18).toString("base64url");

export function inviteUrl(token: string) {
  return `${process.env.APP_URL ?? ""}/convite/${token}`;
}

export function shareLinks(url: string, professionalName: string, clientName?: string | null) {
  const hello = clientName ? `Olá, ${clientName.split(" ")[0]}! ` : "Olá! ";
  const text = `${hello}${professionalName} convidou você para a DRAP Concord: crie sua conta para agendar, confirmar e acompanhar seus atendimentos. ${url}`;
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    email: `mailto:?subject=${encodeURIComponent(`Convite de ${professionalName}`)}&body=${encodeURIComponent(text)}`,
  };
}

export async function createInvite(input: { orgId: string; professionalId: string; createdById: string; kind: InviteKind; clientId?: string; label?: string }) {
  return db.invite.create({
    data: {
      ...input,
      token: newToken(),
      ...(input.kind === "PERSONAL" ? { maxUses: 1, expiresAt: addDays(new Date(), 30) } : {}),
    },
  });
}

/** Link geral ativo do profissional (cria se ainda não existir). */
export async function generalInvite(pro: { id: string; orgId: string }, createdById: string) {
  const existing = await db.invite.findFirst({ where: { professionalId: pro.id, kind: "GENERAL", revokedAt: null }, orderBy: { createdAt: "desc" } });
  return existing ?? createInvite({ orgId: pro.orgId, professionalId: pro.id, createdById, kind: "GENERAL", label: "Link geral" });
}

export function inviteStatus(i: { revokedAt: Date | null; expiresAt: Date | null; maxUses: number | null; uses: number }) {
  if (i.revokedAt) return "revogado" as const;
  if (i.expiresAt && i.expiresAt < new Date()) return "expirado" as const;
  if (i.maxUses !== null && i.uses >= i.maxUses) return "usado" as const;
  return "ativo" as const;
}

export async function findInvite(token: string) {
  const invite = await db.invite.findUnique({
    where: { token },
    include: { professional: { include: { profile: true } }, client: true },
  });
  return invite && inviteStatus(invite) === "ativo" ? invite : null;
}

/**
 * Liga a conta (Acesso 2) ao profissional do convite. No convite pessoal a conta
 * assume o cadastro existente; no geral, reaproveita um cadastro com o mesmo
 * e-mail ou cria um novo.
 */
export async function acceptInvite(token: string, user: { id: string; name: string; email: string; phone: string | null }) {
  const invite = await findInvite(token);
  if (!invite) throw new Error("Convite inválido ou expirado.");
  const orgId = invite.orgId;

  let client = await db.client.findFirst({ where: { orgId, userId: user.id } });
  if (!client && invite.client && (!invite.client.userId || invite.client.userId === user.id)) {
    client = await db.client.update({
      where: { id: invite.client.id },
      data: { userId: user.id, email: invite.client.email ?? user.email, phone: invite.client.phone ?? user.phone },
    });
  }
  if (!client) {
    const sameEmail = await db.client.findFirst({ where: { orgId, userId: null, email: { equals: user.email, mode: "insensitive" } } });
    client = sameEmail
      ? await db.client.update({ where: { id: sameEmail.id }, data: { userId: user.id } })
      : await db.client.create({ data: { orgId, userId: user.id, name: user.name, email: user.email, phone: user.phone, stage: "LEAD", tags: ["via-convite"] } });
  }

  await db.invite.update({ where: { id: invite.id }, data: { uses: { increment: 1 } } });
  await notify(invite.professional.userId, "Convite aceito", `${user.name} criou a conta de acesso e já pode agendar com você.`, `/app/clientes/${client.id}`);
  await audit({ orgId, userId: user.id, action: "invite.accepted", entity: "Invite", entityId: invite.id, meta: { clientId: client.id } });
  return { invite, client };
}
