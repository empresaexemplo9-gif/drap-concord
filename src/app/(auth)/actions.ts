"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { failures } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";
import { acceptInvite } from "@/lib/invites";

const back = (path: string, msg: string, extra: Record<string, string> = {}) =>
  redirect(`${path}?${new URLSearchParams({ erro: msg, ...extra })}`);

const safeNext = (n: unknown) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : null);

export async function login(form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeNext(form.get("next"));
  const convite = String(form.get("convite") ?? "");
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
  if (convite) {
    if (user!.role !== "CLIENT") back(`/convite/${convite}`, "Esta é uma conta de profissional (Acesso 1). Convites são para contas de cliente (Acesso 2).");
    try {
      await acceptInvite(convite, user!);
    } catch (e) {
      back(`/convite/${convite}`, (e as Error).message);
    }
    redirect("/minha-conta?bemvindo=1");
  }
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

const clientSignupSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome."),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  phone: z.string().trim().min(8, "Informe um celular para contato."),
  password: z.string().min(8, "A senha precisa de pelo menos 8 caracteres."),
  consent: z.literal("on", { errorMap: () => ({ message: "É preciso aceitar os termos e a política de privacidade." }) }),
});

/** Cria conta de cliente (Acesso 2), opcionalmente a partir de um convite de profissional. */
export async function signupClient(form: FormData) {
  const convite = String(form.get("convite") ?? "");
  const backTo = convite ? `/convite/${convite}` : "/cadastro/cliente";
  const parsed = clientSignupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) back(backTo, parsed.error.issues[0].message);
  const { name, email, phone, password } = parsed.data!;
  const ip = (await headers()).get("x-forwarded-for") ?? "local";
  if (failures.blocked(`signup:${ip}`, 20)) back(backTo, "Muitas tentativas. Aguarde alguns minutos.");
  failures.add(`signup:${ip}`, 60 * 60_000);
  if (await db.user.findUnique({ where: { email } })) back(backTo, "Já existe uma conta com esse e-mail. Use “Já tenho conta” para entrar.");
  const user = await db.user.create({
    data: {
      name, email, phone, role: "CLIENT", passwordHash: await hashPassword(password),
      consents: { create: { purpose: "Termos de uso e política de privacidade", textVersion: "2026-01" } },
    },
  });
  await createSession(user.id);
  if (convite) {
    try {
      await acceptInvite(convite, user);
    } catch {
      redirect("/minha-conta?bemvindo=1&convite=invalido");
    }
  }
  redirect("/minha-conta?bemvindo=1");
}
