"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { acceptInvite } from "@/lib/invites";

/** Cliente já logado (Acesso 2) liga a conta ao profissional com um clique. */
export async function linkInvite(form: FormData) {
  const token = String(form.get("convite") ?? "");
  const user = await requireUser(["CLIENT"], `/convite/${token}`);
  try {
    await acceptInvite(token, user);
  } catch (e) {
    redirect(`/convite/${token}?erro=${encodeURIComponent((e as Error).message)}`);
  }
  redirect("/minha-conta?bemvindo=1");
}
