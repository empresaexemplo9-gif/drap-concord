import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { professionalConfig } from "@/lib/profiles/registry";
import type { CareType } from "@/lib/profiles/schema";
import { evaluateTriage, type Answers, type TriageOutcome } from "./engine";

type ProLike = { id: string; orgId: string; profileId: string; profileVersion: number; overrides: unknown };

export async function careTypesFor(pro: ProLike) {
  return (await professionalConfig(pro)).careTypes;
}

/** Serviço do profissional para o nome indicado pela triagem (ou o primeiro ativo). */
export async function resolveService(professionalId: string, name: string | undefined, fallbackNames: string[] = []) {
  const services = await db.service.findMany({ where: { professionalId, active: true }, orderBy: { createdAt: "asc" } });
  const norm = (s: string) => s.trim().toLowerCase();
  for (const n of [name, ...fallbackNames].filter(Boolean) as string[]) {
    const hit = services.find((s) => norm(s.name) === norm(n));
    if (hit) return hit;
  }
  return services[0] ?? null;
}

export async function saveTriage(pro: ProLike, careType: CareType, answers: Answers) {
  const outcome = evaluateTriage(careType, answers);
  return db.triageResponse.create({
    data: {
      orgId: pro.orgId,
      professionalId: pro.id,
      careTypeKey: careType.key,
      careTypeName: careType.name,
      answers: answers as Prisma.InputJsonValue,
      outcome: outcome as unknown as Prisma.InputJsonValue,
    },
  });
}

export const outcomeOf = (t: { outcome: unknown }) => t.outcome as TriageOutcome;
