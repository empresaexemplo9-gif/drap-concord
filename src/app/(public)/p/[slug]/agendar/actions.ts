"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createSession, getUser, hashPassword } from "@/lib/auth";
import { book, BookingError } from "@/lib/booking";
import { professionalConfig } from "@/lib/profiles/registry";
import { rateLimit } from "@/lib/ratelimit";

const base = z.object({
  slug: z.string(),
  serviceId: z.string(),
  start: z.string().min(1, "Escolha um horário."),
  consent: z.literal("on", { errorMap: () => ({ message: "É preciso autorizar o uso dos seus dados (LGPD) para agendar." }) }),
});
const newAccount = z.object({
  name: z.string().trim().min(2, "Informe seu nome."),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  phone: z.string().trim().min(8, "Informe um telefone para contato."),
  password: z.string().min(8, "A senha precisa de pelo menos 8 caracteres."),
});

export async function bookPublic(form: FormData) {
  const raw = Object.fromEntries(form) as Record<string, string>;
  const back = (msg: string) =>
    redirect(`/p/${raw.slug}/agendar?servico=${raw.serviceId}&horario=${encodeURIComponent(raw.start ?? "")}&erro=${encodeURIComponent(msg)}`);

  const b = base.safeParse(raw);
  if (!b.success) back(b.error.issues[0].message);
  const pro = await db.professional.findFirst({ where: { slug: raw.slug, isPublic: true } });
  if (!pro) redirect("/");
  const cfg = await professionalConfig(pro);

  let user = await getUser();
  if (user && user.role !== "CLIENT") back("Você está logado como profissional. Saia da conta para agendar como cliente.");
  if (!user) {
    const n = newAccount.safeParse(raw);
    if (!n.success) back(n.error.issues[0].message);
    if (!rateLimit(`signup:${n.data!.email}`, 5)) back("Muitas tentativas. Aguarde alguns minutos.");
    if (await db.user.findUnique({ where: { email: n.data!.email } })) {
      back("Você já tem conta com esse e-mail. Entre para concluir o agendamento.");
    }
    const created = await db.user.create({
      data: { name: n.data!.name, email: n.data!.email, phone: n.data!.phone, role: "CLIENT", passwordHash: await hashPassword(n.data!.password) },
      include: { memberships: true, professional: true },
    });
    await createSession(created.id);
    user = created;
  }

  // Formulário prévio definido pelo perfil do profissional.
  const intake: Record<string, string | string[]> = {};
  for (const f of cfg.intakeForm?.sections.flatMap((s) => s.fields) ?? []) {
    const values = form.getAll(`i_${f.key}`).map(String).filter(Boolean);
    if (f.required && !f.showIf && values.length === 0) back(`Responda: ${f.label}`);
    if (values.length) intake[f.key] = f.type === "multiselect" || f.type === "checklist" ? values : values[0];
  }

  const existing = await db.client.findFirst({ where: { orgId: pro.orgId, userId: user!.id } });
  const client = existing
    ? await db.client.update({ where: { id: existing.id }, data: { intake: { ...(existing.intake as object), ...intake } as Prisma.InputJsonValue } })
    : await db.client.create({
        data: { orgId: pro.orgId, userId: user!.id, name: user!.name, email: user!.email, phone: user!.phone, stage: "FIRST_VISIT", intake },
      });
  await db.consent.createMany({
    data: cfg.compliance.consents.map((purpose) => ({ userId: user!.id, purpose: `${purpose} · ${pro.displayName}`, textVersion: "2026-01" })),
  });

  try {
    const appt = await book({ professionalId: pro.id, serviceId: raw.serviceId, clientId: client.id, startsAt: new Date(raw.start) });
    redirect(`/p/${pro.slug}/agendado?id=${appt.id}`);
  } catch (e) {
    if (e instanceof BookingError) back(e.message);
    throw e;
  }
}
