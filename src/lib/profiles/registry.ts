import { db } from "@/lib/db";
import { profileConfigSchema, resolveProfile, type ProfileConfig } from "./schema";

/** Perfis publicados: alimentam o cadastro, as categorias da vitrine e os filtros. */
export async function publishedProfiles() {
  const rows = await db.professionProfile.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => ({ ...r, config: profileConfigSchema.parse(r.config) }));
}

export async function categories() {
  const profiles = await publishedProfiles();
  return [...new Set(profiles.map((p) => p.config.category))].sort();
}

/**
 * Configuração efetiva do profissional: a versão do perfil que ele adotou
 * (histórico em ProfileVersion) + as personalizações dele.
 */
export async function professionalConfig(pro: {
  profileId: string;
  profileVersion: number;
  overrides: unknown;
}): Promise<ProfileConfig> {
  const version = await db.profileVersion.findUnique({
    where: { profileId_version: { profileId: pro.profileId, version: pro.profileVersion } },
  });
  const raw =
    version?.config ??
    (await db.professionProfile.findUniqueOrThrow({ where: { id: pro.profileId } })).config;
  return resolveProfile(profileConfigSchema.parse(raw), pro.overrides);
}

/** Recepção/financeiro não veem o registro do atendimento quando o perfil restringe. */
export function canSeeRecords(memberRole: string, cfg: ProfileConfig) {
  return !(cfg.compliance.recordHiddenFrom as string[]).includes(memberRole);
}
