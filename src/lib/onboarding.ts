import { db } from "./db";
import { slugify } from "./format";
import { profileConfigSchema } from "./profiles/schema";

/** Aplica um Perfil Profissional: cria organização, serviços, horários e regras padrão. */
export async function applyProfile(input: {
  userId: string;
  profileKey: string;
  displayName: string;
  city?: string;
  registryNumber?: string;
  /** Prévia do admin: permite perfis ainda não publicados. */
  allowUnpublished?: boolean;
}) {
  const profile = await db.professionProfile.findUniqueOrThrow({ where: { key: input.profileKey } });
  if (profile.status !== "PUBLISHED" && !input.allowUnpublished) throw new Error("Perfil não publicado");
  const cfg = profileConfigSchema.parse(profile.config);

  let slug = slugify(input.displayName) || "profissional";
  for (let i = 2; await db.professional.findUnique({ where: { slug } }); i++) slug = `${slugify(input.displayName)}-${i}`;

  return db.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name: input.displayName, trialEndsAt: new Date(Date.now() + 14 * 86_400_000) },
    });
    await tx.membership.create({ data: { orgId: org.id, userId: input.userId, role: "OWNER" } });
    const pro = await tx.professional.create({
      data: {
        orgId: org.id,
        userId: input.userId,
        profileId: profile.id,
        profileVersion: profile.version,
        slug,
        displayName: input.displayName,
        city: input.city,
        registryNumber: input.registryNumber,
        headline: cfg.terminology.professional,
      },
    });
    await tx.service.createMany({
      data: cfg.services.map((s) => ({
        orgId: org.id, professionalId: pro.id, name: s.name, durationMin: s.durationMin, priceCents: s.priceCents, modality: s.modality,
      })),
    });
    // Horário inicial sugerido: seg a sex, 9h às 18h (o profissional ajusta).
    await tx.availability.createMany({
      data: [1, 2, 3, 4, 5].map((weekday) => ({ professionalId: pro.id, weekday, startMin: 9 * 60, endMin: 18 * 60 })),
    });
    await tx.rule.createMany({
      data: cfg.rules.map((r) => ({
        orgId: org.id, professionalId: pro.id, key: r.key, name: r.name, trigger: r.trigger,
        conditions: r.conditions, actions: r.actions, mode: r.mode,
      })),
    });
    await tx.auditLog.create({ data: { orgId: org.id, userId: input.userId, action: "profile.applied", entity: "Professional", entityId: pro.id, meta: { profile: profile.key, version: profile.version } } });
    return pro;
  });
}

