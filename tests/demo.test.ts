import { afterAll, describe, expect, it, vi } from "vitest";

// A busca da vitrine usa módulos marcados como "só servidor"; no teste isso não se aplica.
vi.mock("server-only", () => ({}));

import { db } from "@/lib/db";
import { cleanupDemos, createDemo, demoCounterpart, demoToken, isDemoUser } from "@/lib/demo";
import { searchProfessionals } from "@/lib/search";

// Integração: requer o banco (DATABASE_URL) com os perfis publicados (seed).
const created: string[] = [];

afterAll(async () => {
  // Remove o que sobrou dos testes, mesmo que ainda não tenha vencido.
  const users = await db.user.findMany({ where: { id: { in: created } }, select: { id: true, professional: { select: { orgId: true } } } });
  const orgIds = users.flatMap((u) => (u.professional ? [u.professional.orgId] : []));
  await db.appointment.deleteMany({ where: { orgId: { in: orgIds } } });
  await db.organization.deleteMany({ where: { id: { in: orgIds } } });
  await db.user.deleteMany({ where: { id: { in: created } } });
  await db.$disconnect();
});

describe("demonstração sem cadastro", () => {
  it("cria profissional e cliente de exemplo isolados, com agenda, ficha e avaliações", async () => {
    const profile = await db.professionProfile.findFirstOrThrow({ where: { status: "PUBLISHED" } });
    const demo = await createDemo(profile.key, "Teste Demo");
    created.push(demo.professionalUserId, demo.clientUserId);

    const pro = await db.user.findUniqueOrThrow({ where: { id: demo.professionalUserId }, include: { professional: true } });
    expect(pro.isSandbox).toBe(true);
    expect(isDemoUser(pro)).toBe(true);
    expect(demoToken(pro.email)).toBe(demo.token);
    expect(pro.professional!.isPublic).toBe(false);
    expect(pro.professional!.displayName).toBe("Teste Demo");

    const orgId = pro.professional!.orgId;
    expect(await db.client.count({ where: { orgId } })).toBe(5);
    expect(await db.appointment.count({ where: { orgId } })).toBeGreaterThanOrEqual(10);
    expect(await db.attendanceRecord.count({ where: { orgId } })).toBe(1);
    expect(await db.review.count({ where: { professionalId: pro.professional!.id, status: "APPROVED" } })).toBe(2);
    expect(await db.service.count({ where: { orgId } })).toBeGreaterThan(0);

    // A cliente de exemplo tem conta (Acesso 2) ligada a esta organização, e as duas contas se encontram.
    const client = await db.client.findFirstOrThrow({ where: { orgId, userId: demo.clientUserId } });
    expect(client.name).toBeTruthy();
    expect((await demoCounterpart(pro))?.id).toBe(demo.clientUserId);
    const clientUser = await db.user.findUniqueOrThrow({ where: { id: demo.clientUserId } });
    expect((await demoCounterpart(clientUser))?.id).toBe(demo.professionalUserId);

    // Nunca aparece na vitrine, nem se marcada como pública.
    await db.professional.update({ where: { id: pro.professional!.id }, data: { isPublic: true } });
    const results = await searchProfessionals({ q: "Teste Demo" });
    expect(results.map((r) => r.pro.id)).not.toContain(pro.professional!.id);
  });

  it("limpeza apaga só demonstrações vencidas, com tudo o que pende delas", async () => {
    const profile = await db.professionProfile.findFirstOrThrow({ where: { status: "PUBLISHED" } });
    const old = await createDemo(profile.key);
    const fresh = await createDemo(profile.key);
    created.push(old.professionalUserId, old.clientUserId, fresh.professionalUserId, fresh.clientUserId);
    const oldOrg = (await db.professional.findUniqueOrThrow({ where: { userId: old.professionalUserId } })).orgId;
    await db.user.updateMany({ where: { id: { in: [old.professionalUserId, old.clientUserId] } }, data: { createdAt: new Date(Date.now() - 25 * 3_600_000) } });

    expect(await cleanupDemos()).toBeGreaterThanOrEqual(2);
    expect(await db.user.count({ where: { id: { in: [old.professionalUserId, old.clientUserId] } } })).toBe(0);
    expect(await db.organization.count({ where: { id: oldOrg } })).toBe(0);
    expect(await db.appointment.count({ where: { orgId: oldOrg } })).toBe(0);
    expect(await db.user.count({ where: { id: { in: [fresh.professionalUserId, fresh.clientUserId] } } })).toBe(2);
  });

  it("não abre demonstração de profissão não publicada", async () => {
    const draft = await db.professionProfile.findFirst({ where: { status: { not: "PUBLISHED" } } });
    if (!draft) return;
    await expect(createDemo(draft.key)).rejects.toThrow();
  });

  it("reconhece só e-mails de demonstração", () => {
    expect(demoToken("profissional.0123456789abcdef@demo.drapconcord.invalid")).toBe("0123456789abcdef");
    expect(demoToken("profissional.0123456789abcdef@demo.drapconcord.invalid.com")).toBeNull();
    expect(demoToken("ana@concord.dev")).toBeNull();
    expect(isDemoUser({ email: "cliente.0123456789abcdef@demo.drapconcord.invalid", isSandbox: false })).toBe(false);
  });
});
