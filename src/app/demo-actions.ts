"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSession, destroySession, getImpersonator, getUser } from "@/lib/auth";
import { cleanupDemos, createDemo, demoCounterpart, DEMO_TTL_HOURS, isDemoUser } from "@/lib/demo";
import { rateLimit } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";

const fail = (msg: string) => redirect(`/experimentar?${new URLSearchParams({ erro: msg })}`);

/** Começa uma demonstração da profissão escolhida, sem cadastro. */
export async function startDemo(form: FormData) {
  const profileKey = String(form.get("perfil") ?? "");
  const name = String(form.get("nome") ?? "");
  if (await getImpersonator()) fail("Saia do \"Ver como\" do admin antes de abrir uma demonstração.");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`demo:${ip}`, 6, 60 * 60_000)) fail("Você abriu várias demonstrações seguidas. Tente de novo em alguns minutos.");

  // Aproveita para apagar demonstrações vencidas.
  await cleanupDemos().catch(() => 0);
  let demo;
  try {
    demo = await createDemo(profileKey, name);
  } catch {
    fail("Não foi possível abrir a demonstração dessa profissão. Escolha outra.");
  }
  // Quem estava com outra conta aberta sai dela: a demonstração usa uma sessão própria.
  await destroySession();
  await createSession(demo!.professionalUserId, new Date(Date.now() + DEMO_TTL_HOURS * 3_600_000));
  await audit({ userId: demo!.professionalUserId, action: "demo.start", entity: "User", entityId: demo!.professionalUserId, meta: { profileKey } });
  redirect("/app?demo=1");
}

/** Alterna entre o profissional e a cliente de exemplo da mesma demonstração. */
export async function switchDemoView() {
  const user = await getUser();
  if (!isDemoUser(user)) redirect("/experimentar");
  const other = await demoCounterpart(user!);
  if (!other) redirect("/experimentar");
  await destroySession();
  await createSession(other!.id, new Date(other!.createdAt.getTime() + DEMO_TTL_HOURS * 3_600_000));
  redirect(other!.role === "CLIENT" ? "/minha-conta" : "/app");
}

/** Encerra a demonstração e leva ao cadastro de verdade (ou de volta à escolha). */
export async function endDemo(form: FormData) {
  await destroySession();
  redirect(form.get("para") === "cadastro" ? "/cadastro" : "/experimentar");
}
