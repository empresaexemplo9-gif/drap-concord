"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { failures } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";

const back = (path: string, msg: string, extra: Record<string, string> = {}) =>
  redirect(`${path}?${new URLSearchParams({ erro: msg, ...extra })}`);

const safeNext = (n: unknown) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : null);

export async function login(form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeNext(form.get("next"));
  const ip = (await headers()).get("x-forwarded-for") ?? "local";
  const key = `login:${ip}:${email}`;
  if (failures.blocked(key)) back("/entrar", "Muitas tentativas erradas. Aguarde alguns minutos.");
  const user = await db.user.findUnique({ where: { email }, include: { professional: true } });
  if (!user || user.isSandbox || !(await verifyPassword(password, user.passwordHash))) {
    failures.add(key);
    back("/entrar", "E-mail ou senha incorretos.", next ? { next } : {});
  }
  failures.clear(key);
  await createSession(user!.id);
  await audit({ userId: user!.id, action: "auth.login", entity: "User", entityId: user!.id });
  if (next) redirect(next);
  if (user!.role === "PLATFORM_ADMIN") redirect("/admin/perfis");
  if (user!.role === "CLIENT") redirect("/minha-conta");
  redirect(user!.professional ? "/app" : "/onboarding");
}

const signupSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome."),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  password: z.string().min(8, "A senha precisa de pelo menos 8 caracteres."),
  consent: z.literal("on", { errorMap: () => ({ message: "É preciso aceitar os termos e a política de privacidade." }) }),
});

export async function signupProfessional(form: FormData) {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) back("/cadastro", parsed.error.issues[0].message);
  const { name, email, password } = parsed.data!;
  if (await db.user.findUnique({ where: { email } })) back("/cadastro", "Já existe uma conta com esse e-mail. Entre com sua senha.");
  const user = await db.user.create({
    data: {
      name, email, role: "PROFESSIONAL", passwordHash: await hashPassword(password),
      consents: { create: { purpose: "Termos de uso e política de privacidade", textVersion: "2026-01" } },
    },
  });
  await createSession(user.id);
  redirect("/onboarding");
}

export async function logout() {
  await destroySession();
  redirect("/");
}
