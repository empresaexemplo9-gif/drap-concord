import { randomBytes } from "node:crypto";
import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { MemberRole } from "@prisma/client";
import { db } from "./db";
import { applyProfile } from "./onboarding";

// Contas de prévia do admin: permitem ver a plataforma como qualquer profissão
// (mesmo sem profissional real ou com o perfil em rascunho) e como qualquer
// papel de equipe. Não fazem login (senha inutilizável + isSandbox) e não
// aparecem na vitrine.

const DOMAIN = "previa.drapconcord.invalid";
const unusablePassword = () => `!sandbox-${randomBytes(16).toString("hex")}`;

async function sampleData(professionalId: string) {
  const pro = await db.professional.findUniqueOrThrow({ where: { id: professionalId }, include: { services: true } });
  const service = pro.services[0];
  if (!service) return;
  const at = (days: number, h: number) => {
    const date = formatInTimeZone(addDays(new Date(), days), pro.timezone, "yyyy-MM-dd");
    return fromZonedTime(`${date}T${String(h).padStart(2, "0")}:00:00`, pro.timezone);
  };
  const [a, b] = await Promise.all(
    ["Laura Mendes (exemplo)", "Rafael Lima (exemplo)"].map((name, i) =>
      db.client.create({ data: { orgId: pro.orgId, name, email: `cliente${i + 1}@${DOMAIN}`, stage: i ? "FIRST_VISIT" : "ACTIVE", tags: ["exemplo"] } }),
    ),
  );
  const mk = (clientId: string, start: Date, status: "DONE" | "CONFIRMED" | "PENDING") =>
    db.appointment.create({
      data: {
        orgId: pro.orgId, professionalId: pro.id, clientId, serviceId: service.id, modality: service.modality,
        startsAt: start, endsAt: new Date(start.getTime() + service.durationMin * 60_000), status,
      },
    });
  await mk(a.id, at(-7, 10), "DONE");
  await mk(a.id, at(0, 15), "CONFIRMED");
  await mk(b.id, at(1, 10), "PENDING");
  await mk(a.id, at(7, 10), "PENDING");
}

/** Profissional de prévia de uma profissão (criado uma vez, com dados de exemplo). */
export async function ensureSandboxProfessional(profileId: string) {
  const profile = await db.professionProfile.findUniqueOrThrow({ where: { id: profileId } });
  const email = `profissional.${profile.key}@${DOMAIN}`;
  const existing = await db.user.findUnique({ where: { email }, include: { professional: true } });
  if (existing?.professional) return existing;
  const user =
    existing ??
    (await db.user.create({
      data: { email, name: `Prévia · ${profile.name}`, role: "PROFESSIONAL", isSandbox: true, passwordHash: unusablePassword() },
    }));
  const pro = await applyProfile({ userId: user.id, profileKey: profile.key, displayName: `Prévia · ${profile.name}`, city: "São Paulo", allowUnpublished: true });
  await db.professional.update({
    where: { id: pro.id },
    data: { isPublic: false, bio: `Conta de prévia para o admin ver a plataforma como ${profile.name}. Não aparece para o público.` },
  });
  await sampleData(pro.id);
  return db.user.findUniqueOrThrow({ where: { id: user.id }, include: { professional: true } });
}

/** Membro de equipe de prévia (recepção ou financeiro) na organização de um profissional. */
export async function ensureTeamMember(professionalId: string, role: Exclude<MemberRole, "OWNER" | "PROFESSIONAL">) {
  const pro = await db.professional.findUniqueOrThrow({ where: { id: professionalId } });
  const email = `${role.toLowerCase()}.${pro.orgId}@${DOMAIN}`;
  const label = role === "RECEPTION" ? "Recepção" : "Financeiro";
  const user =
    (await db.user.findUnique({ where: { email } })) ??
    (await db.user.create({
      data: { email, name: `${label} · ${pro.displayName}`, role: "PROFESSIONAL", isSandbox: true, passwordHash: unusablePassword() },
    }));
  await db.membership.upsert({
    where: { orgId_userId: { orgId: pro.orgId, userId: user.id } },
    update: { role },
    create: { orgId: pro.orgId, userId: user.id, role },
  });
  return user;
}
