import { randomBytes } from "node:crypto";
import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { AppointmentStatus, Prisma } from "@prisma/client";
import { db } from "./db";
import { applyProfile } from "./onboarding";
import { profileConfigSchema, type ProfileConfig } from "./profiles/schema";

// Demonstração pública: qualquer visitante escolhe uma profissão e entra no
// app do profissional sem cadastro, com clientes, agenda e fichas de exemplo.
// Cada demonstração é isolada (organização própria), não faz login por senha,
// não aparece na vitrine e é apagada depois de DEMO_TTL_HOURS.

export const DEMO_DOMAIN = "demo.drapconcord.invalid";
export const DEMO_TTL_HOURS = 24;

const unusablePassword = () => `!demo-${randomBytes(16).toString("hex")}`;
const emailFor = (kind: "profissional" | "cliente", token: string) => `${kind}.${token}@${DEMO_DOMAIN}`;

/** Token da demonstração a partir do e-mail de uma conta dela (ou null se não for demonstração). */
export function demoToken(email: string) {
  const m = email.match(new RegExp(`^(?:profissional|cliente)\\.([a-f0-9]{16})@${DEMO_DOMAIN.replace(/\./g, "\\.")}$`));
  return m ? m[1] : null;
}

export const isDemoUser = (u: { email: string; isSandbox: boolean } | null | undefined) => !!u && u.isSandbox && demoToken(u.email) !== null;

const SAMPLE_CLIENTS = [
  { name: "Laura Mendes", stage: "ACTIVE", tags: ["recorrente"], notes: "Prefere horários pela manhã." },
  { name: "Rafael Lima", stage: "FIRST_VISIT", tags: ["indicação"], notes: null },
  { name: "Beatriz Souza", stage: "ACTIVE", tags: ["recorrente", "online"], notes: null },
  { name: "Carlos Pereira", stage: "LEAD", tags: ["site"], notes: "Chegou pela página pública." },
  { name: "Marina Alves", stage: "INACTIVE", tags: [], notes: "Não volta há 2 meses." },
] as const;

/** Valor de exemplo para um campo da ficha, de acordo com o tipo. */
function sampleValue(field: ProfileConfig["recordTemplate"]["sections"][number]["fields"][number]): unknown {
  switch (field.type) {
    case "text":
      return "Exemplo preenchido na demonstração";
    case "textarea":
      return "Anotações de exemplo: evolução positiva, combinar retorno na próxima semana.";
    case "number":
      return field.min ?? 1;
    case "scale":
      return Math.round(((field.min ?? 0) + (field.max ?? 10)) / 2);
    case "date":
      return new Date().toISOString().slice(0, 10);
    case "select":
      return field.options?.[0] ?? "";
    case "multiselect":
    case "checklist":
      return field.options?.slice(0, 1) ?? [];
    default:
      return undefined; // upload e assinatura ficam em branco
  }
}

/**
 * Cria uma demonstração completa da profissão: profissional (Acesso 1) com
 * serviços e horários do perfil, clientes, agenda (passada e futura), ficha
 * preenchida, avaliação, notificações e uma cliente com conta (Acesso 2) para
 * ver o portal do cliente. Devolve os ids das duas contas.
 */
export async function createDemo(profileKey: string, name?: string) {
  const profile = await db.professionProfile.findUniqueOrThrow({ where: { key: profileKey } });
  if (profile.status !== "PUBLISHED") throw new Error("Profissão indisponível para demonstração.");
  const cfg = profileConfigSchema.parse(profile.config);
  const token = randomBytes(8).toString("hex");
  const displayName = name?.trim().slice(0, 60) || "Visitante Demonstração";

  const proUser = await db.user.create({
    data: { email: emailFor("profissional", token), name: displayName, role: "PROFESSIONAL", isSandbox: true, passwordHash: unusablePassword() },
  });
  // Slug único pelo token (evita colisão entre demonstrações); o nome exibido vem depois.
  const created = await applyProfile({ userId: proUser.id, profileKey: profile.key, displayName: `Demo ${token}`, city: "São Paulo" });
  const pro = await db.professional.update({
    where: { id: created.id },
    data: {
      displayName,
      isPublic: false,
      registryVerified: true,
      bio: `Esta é uma demonstração da DRAP Concord para ${profile.name}. Os dados são fictícios e apagados em ${DEMO_TTL_HOURS} horas.`,
      specialties: cfg.services.slice(0, 3).map((s) => s.name),
    },
    include: { services: { orderBy: { createdAt: "asc" } } },
  });
  await db.organization.update({ where: { id: pro.orgId }, data: { name: displayName } });

  const at = (days: number, h: number) => {
    const date = formatInTimeZone(addDays(new Date(), days), pro.timezone, "yyyy-MM-dd");
    return fromZonedTime(`${date}T${String(h).padStart(2, "0")}:00:00`, pro.timezone);
  };
  const svc = (i: number) => pro.services[i % pro.services.length];

  // Cliente com conta (Acesso 2): mostra o portal do cliente na mesma demonstração.
  const clientUser = await db.user.create({
    data: { email: emailFor("cliente", token), name: SAMPLE_CLIENTS[0].name, role: "CLIENT", isSandbox: true, passwordHash: unusablePassword() },
  });
  const clients = await Promise.all(
    SAMPLE_CLIENTS.map((c, i) =>
      db.client.create({
        data: {
          orgId: pro.orgId,
          userId: i === 0 ? clientUser.id : null,
          name: c.name,
          email: `cliente${i + 1}.${token}@${DEMO_DOMAIN}`,
          phone: `(11) 9${String(8000 + i * 111).padStart(4, "0")}-${String(1000 + i * 37).slice(-4)}`,
          stage: c.stage,
          tags: [...c.tags],
          notes: c.notes,
        },
      }),
    ),
  );

  const plan: [client: number, days: number, hour: number, status: AppointmentStatus, service: number][] = [
    [0, -14, 10, "DONE", 0],
    [2, -10, 14, "DONE", 1],
    [1, -7, 9, "NO_SHOW", 0],
    [0, -7, 10, "DONE", 0],
    [4, -5, 16, "CANCELED_BY_CLIENT", 1],
    [2, -3, 11, "DONE", 1],
    [0, 0, 9, "CONFIRMED", 0],
    [2, 0, 14, "CONFIRMED", 1],
    [1, 0, 16, "PENDING", 0],
    [3, 1, 10, "PENDING", 0],
    [0, 2, 15, "CONFIRMED", 0],
    [2, 4, 11, "PENDING", 1],
    [1, 7, 10, "PENDING", 0],
    [0, 7, 9, "PENDING", 0],
  ];
  const appts = [];
  for (const [c, days, hour, status, s] of plan) {
    const service = svc(s);
    const startsAt = at(days, hour);
    appts.push(
      await db.appointment.create({
        data: {
          orgId: pro.orgId, professionalId: pro.id, clientId: clients[c].id, serviceId: service.id, modality: service.modality,
          startsAt, endsAt: new Date(startsAt.getTime() + service.durationMin * 60_000), status,
          cancelReason: status === "CANCELED_BY_CLIENT" ? "Imprevisto no trabalho." : null,
        },
      }),
    );
  }

  // Ficha preenchida no último atendimento concluído da cliente com conta.
  const done = appts.find((a, i) => plan[i][0] === 0 && a.status === "DONE" && plan[i][1] === -7);
  if (done) {
    const data: Record<string, unknown> = {};
    for (const section of cfg.recordTemplate.sections)
      for (const f of section.fields) {
        const v = sampleValue(f);
        if (v !== undefined) data[f.key] = v;
      }
    await db.attendanceRecord.create({
      data: { orgId: pro.orgId, professionalId: pro.id, clientId: clients[0].id, appointmentId: done.id, templateVersion: pro.profileVersion, data: data as Prisma.InputJsonValue },
    });
  }

  await db.review.createMany({
    data: [
      { professionalId: pro.id, clientId: clients[0].id, rating: 5, comment: "Atendimento excelente, pontual e muito atencioso.", status: "APPROVED" },
      { professionalId: pro.id, clientId: clients[2].id, rating: 4, comment: "Gostei muito, recomendo.", status: "APPROVED" },
    ],
  });

  const clientWord = cfg.terminology.client.singular.toLowerCase();
  await db.notification.createMany({
    data: [
      { userId: proUser.id, title: "Bem-vindo(a) à demonstração", body: `Explore à vontade: os dados são fictícios e somem em ${DEMO_TTL_HOURS} horas. Nada é enviado a pessoas reais.`, link: "/app" },
      { userId: proUser.id, title: `Novo pedido de ${clientWord}`, body: `${SAMPLE_CLIENTS[3].name} pediu um horário pela sua página pública.`, link: "/app/agenda" },
      { userId: clientUser.id, title: "Seu próximo horário", body: `Você tem um horário marcado com ${displayName}. Confirme, remarque ou cancele por aqui.`, link: "/minha-conta" },
    ],
  });

  return { token, professionalUserId: proUser.id, clientUserId: clientUser.id, slug: pro.slug };
}

/** A outra conta da mesma demonstração (profissional ↔ cliente). */
export async function demoCounterpart(user: { email: string; isSandbox: boolean; role: string }) {
  const token = demoToken(user.email);
  if (!user.isSandbox || !token) return null;
  return db.user.findUnique({ where: { email: emailFor(user.role === "CLIENT" ? "profissional" : "cliente", token) } });
}

/** Apaga demonstrações com mais de `hours` horas (contas, organização e tudo o que pende delas). */
export async function cleanupDemos(hours = DEMO_TTL_HOURS) {
  const old = await db.user.findMany({
    where: { isSandbox: true, email: { endsWith: `@${DEMO_DOMAIN}` }, createdAt: { lt: new Date(Date.now() - hours * 3_600_000) } },
    select: { id: true, professional: { select: { orgId: true } } },
    take: 500,
  });
  if (!old.length) return 0;
  const orgIds = old.flatMap((u) => (u.professional ? [u.professional.orgId] : []));
  // Atendimentos antes dos serviços (a relação atendimento → serviço não cascateia).
  await db.appointment.deleteMany({ where: { orgId: { in: orgIds } } });
  await db.organization.deleteMany({ where: { id: { in: orgIds } } });
  await db.user.deleteMany({ where: { id: { in: old.map((u) => u.id) } } });
  return old.length;
}
