// Seed de demonstração: perfis profissionais (dados), usuários e agenda fictícios.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { addDays, startOfDay, subDays } from "date-fns";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { profileConfigSchema } from "../src/lib/profiles/schema";
import { applyProfile } from "../src/lib/onboarding";
import { processThemeImage } from "../src/lib/themes/process";

const TZ = "America/Sao_Paulo";
const PASSWORD = "concord123";

function at(day: Date, h: number, m = 0) {
  const date = formatInTimeZone(day, TZ, "yyyy-MM-dd");
  return fromZonedTime(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`, TZ);
}

async function upsertProfiles() {
  const dir = join(__dirname, "profiles");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const { key, name, config } = JSON.parse(readFileSync(join(dir, file), "utf8"));
    const parsed = profileConfigSchema.parse(config);
    const profile = await db.professionProfile.upsert({
      where: { key },
      update: { name, config: parsed, status: "PUBLISHED" },
      create: { key, name, config: parsed, status: "PUBLISHED", version: 1 },
    });
    await db.profileVersion.upsert({
      where: { profileId_version: { profileId: profile.id, version: profile.version } },
      update: { config: parsed },
      create: { profileId: profile.id, version: profile.version, config: parsed },
    });
  }
}

/** Temas iniciais (imagens em prisma/themes). Só associa a perfis que ainda não têm tema. */
async function upsertThemes() {
  const dir = join(__dirname, "themes");
  const list: { file: string; name: string; profiles: string[] }[] = JSON.parse(readFileSync(join(dir, "themes.json"), "utf8"));
  for (const t of list) {
    const img = await processThemeImage(readFileSync(join(dir, t.file)));
    const existing = await db.professionTheme.findUnique({ where: { name: t.name }, select: { id: true } });
    const theme = existing ?? (await db.professionTheme.create({ data: { name: t.name, ...img, palette: img.palette } }));
    await db.professionProfile.updateMany({ where: { key: { in: t.profiles }, themeId: null }, data: { themeId: theme.id } });
  }
}

/**
 * Serviços novos do perfil (ex.: dos tipos de atendimento) entram nos
 * profissionais de demonstração e de prévia. Profissionais reais não são tocados.
 */
async function syncDemoServices(demoEmails: string[]) {
  const pros = await db.professional.findMany({
    where: { user: { OR: [{ email: { in: demoEmails } }, { isSandbox: true }] } },
    include: { services: true, profile: true },
  });
  for (const pro of pros) {
    const cfg = profileConfigSchema.parse(pro.profile.config);
    const have = new Set(pro.services.map((s) => s.name));
    const missing = cfg.services.filter((s) => !have.has(s.name));
    if (missing.length) {
      await db.service.createMany({
        data: missing.map((s) => ({ orgId: pro.orgId, professionalId: pro.id, name: s.name, durationMin: s.durationMin, priceCents: s.priceCents, modality: s.modality })),
      });
    }
  }
}

async function user(email: string, name: string, role: "PLATFORM_ADMIN" | "PROFESSIONAL" | "CLIENT") {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return db.user.upsert({ where: { email }, update: {}, create: { email, name, role, passwordHash } });
}

async function pro(email: string, name: string, profileKey: string, extra: { city: string; bio: string; specialties: string[]; registry: string }) {
  const u = await user(email, name, "PROFESSIONAL");
  const existing = await db.professional.findUnique({ where: { userId: u.id } });
  if (existing) return existing;
  const p = await applyProfile({ userId: u.id, profileKey, displayName: name, city: extra.city, registryNumber: extra.registry });
  return db.professional.update({
    where: { id: p.id },
    data: { bio: extra.bio, specialties: extra.specialties, registryVerified: true },
  });
}

async function main() {
  await upsertProfiles();
  await upsertThemes();
  await user("admin@concord.dev", "Admin da Plataforma", "PLATFORM_ADMIN");

  // Admin real da plataforma, vindo de variáveis de ambiente (nunca do código).
  // A senha é reaplicada a cada seed, então trocar a variável troca a senha.
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await db.user.upsert({
      where: { email: adminEmail },
      update: { role: "PLATFORM_ADMIN", passwordHash },
      create: { email: adminEmail, name: process.env.ADMIN_NAME ?? "Administrador", role: "PLATFORM_ADMIN", passwordHash },
    });
    console.log(`Admin da plataforma pronto: ${adminEmail}`);
  }

  const ana = await pro("ana@concord.dev", "Ana Ribeiro", "psicologo", {
    city: "São Paulo",
    registry: "CRP 06/123456",
    specialties: ["Ansiedade", "Terapia Cognitivo-Comportamental", "Adultos"],
    bio: "Psicóloga clínica há 10 anos. Acolho adultos que vivem ansiedade, luto e transições de vida, com escuta cuidadosa e sem julgamentos.",
  });
  await pro("carlos@concord.dev", "Carlos Mendes", "advogado", {
    city: "Belo Horizonte",
    registry: "OAB/MG 98.765",
    specialties: ["Direito do Consumidor", "Direito Civil"],
    bio: "Advogado com foco em direito do consumidor e contratos. Explico seus direitos em linguagem simples.",
  });
  await pro("juliana@concord.dev", "Juliana Costa", "personal-trainer", {
    city: "São Paulo",
    registry: "CREF 012345-G/SP",
    specialties: ["Emagrecimento", "Treino funcional", "Idosos"],
    bio: "Personal trainer apaixonada por movimento. Treinos seguros e divertidos, em casa, no parque ou online.",
  });
  await pro("rafael@concord.dev", "Rafael Souza", "professor-esporte", {
    city: "Curitiba",
    registry: "CREF 054321-G/PR",
    specialties: ["Tênis", "Iniciantes", "Crianças"],
    bio: "Professor de tênis há 8 anos. Do primeiro saque ao torneio.",
  });

  await syncDemoServices(["ana@concord.dev", "carlos@concord.dev", "juliana@concord.dev", "rafael@concord.dev"]);

  // Paciente de demonstração com histórico na agenda da Ana.
  const maria = await user("maria@exemplo.com", "Maria Oliveira", "CLIENT");
  const client =
    (await db.client.findFirst({ where: { orgId: ana.orgId, userId: maria.id } })) ??
    (await db.client.create({
      data: { orgId: ana.orgId, userId: maria.id, name: maria.name, email: maria.email, phone: "(11) 98888-7777", stage: "ACTIVE", tags: ["semanal"] },
    }));
  const others = await Promise.all(
    ["João Pereira", "Beatriz Lima", "Pedro Alves"].map(async (name) =>
      (await db.client.findFirst({ where: { orgId: ana.orgId, name } })) ??
      db.client.create({ data: { orgId: ana.orgId, name, email: `${name.split(" ")[0].toLowerCase()}@exemplo.com`, stage: "ACTIVE" } }),
    ),
  );

  if ((await db.appointment.count({ where: { professionalId: ana.id } })) === 0) {
    const service = await db.service.findFirstOrThrow({ where: { professionalId: ana.id, name: "Sessão individual" } });
    const today = startOfDay(new Date());
    const mk = (clientId: string, start: Date, status: "DONE" | "NO_SHOW" | "CONFIRMED" | "PENDING") =>
      db.appointment.create({
        data: { orgId: ana.orgId, professionalId: ana.id, clientId, serviceId: service.id, startsAt: start, endsAt: new Date(start.getTime() + service.durationMin * 60_000), status },
      });
    // Maria: realizada, depois 1 falta (a próxima falta dispara o aviso de 2 faltas).
    await mk(client.id, at(subDays(today, 21), 10), "DONE");
    await mk(client.id, at(subDays(today, 14), 10), "DONE");
    await mk(client.id, at(subDays(today, 7), 10), "NO_SHOW");
    await mk(client.id, at(addDays(today, 7), 10), "PENDING");
    // Agenda da semana com outros pacientes.
    for (let d = 0; d < 5; d++) {
      for (const [i, c] of others.entries()) {
        const day = addDays(today, d);
        if (formatInTimeZone(day, TZ, "i") > "5") continue;
        await mk(c.id, at(day, 14 + i * 1, 0), d === 0 ? "CONFIRMED" : "PENDING");
      }
    }
    await db.review.createMany({
      data: [
        { professionalId: ana.id, clientId: others[0].id, rating: 5, comment: "Me senti acolhido desde a primeira sessão.", status: "APPROVED" },
        { professionalId: ana.id, clientId: others[1].id, rating: 5, comment: "Profissional atenciosa e muito pontual.", status: "APPROVED" },
      ],
    });
  }
  console.log("Seed ok. Senha de todos os usuários de demonstração:", PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
