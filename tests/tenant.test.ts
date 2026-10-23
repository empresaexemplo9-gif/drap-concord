import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { tenant } from "@/lib/tenant";

// Integração: requer o banco (DATABASE_URL). Garante isolamento entre organizações.
let orgA: string, orgB: string, clientB: string, apptB: string;

beforeAll(async () => {
  const profile = await db.professionProfile.findFirstOrThrow();
  const mk = async (tag: string) => {
    const org = await db.organization.create({ data: { name: `teste-${tag}` } });
    const user = await db.user.create({ data: { email: `t-${tag}-${Date.now()}@teste.dev`, name: tag, role: "PROFESSIONAL", passwordHash: "x" } });
    const pro = await db.professional.create({ data: { orgId: org.id, userId: user.id, profileId: profile.id, profileVersion: 1, slug: `t-${tag}-${Date.now()}`, displayName: tag } });
    const service = await db.service.create({ data: { orgId: org.id, professionalId: pro.id, name: "S", durationMin: 30 } });
    const client = await db.client.create({ data: { orgId: org.id, name: `cliente-${tag}` } });
    const appt = await db.appointment.create({ data: { orgId: org.id, professionalId: pro.id, clientId: client.id, serviceId: service.id, startsAt: new Date(), endsAt: new Date() } });
    return { org: org.id, client: client.id, appt: appt.id, user: user.id };
  };
  const a = await mk("A");
  const b = await mk("B");
  orgA = a.org; orgB = b.org; clientB = b.client; apptB = b.appt;
});

afterAll(async () => {
  const users = await db.professional.findMany({ where: { orgId: { in: [orgA, orgB] } }, select: { userId: true } });
  await db.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
  await db.user.deleteMany({ where: { id: { in: users.map((u) => u.userId) } } });
  await db.$disconnect();
});

describe("isolamento multi-tenant", () => {
  it("organização A não lista clientes de B", async () => {
    const list = await tenant(orgA).clients.list();
    expect(list.map((c) => c.id)).not.toContain(clientB);
  });

  it("organização A não lê cliente nem atendimento de B pelo id", async () => {
    expect(await tenant(orgA).clients.get(clientB)).toBeNull();
    expect(await tenant(orgA).appointments.get(apptB)).toBeNull();
  });

  it("organização A não altera atendimento de B", async () => {
    const res = await tenant(orgA).appointments.setStatus(apptB, "CANCELED_BY_PROFESSIONAL");
    expect(res.count).toBe(0);
    const appt = await db.appointment.findUniqueOrThrow({ where: { id: apptB } });
    expect(appt.status).toBe("PENDING");
  });

  it("organização B enxerga os próprios dados", async () => {
    expect(await tenant(orgB).clients.get(clientB)).not.toBeNull();
  });
});
