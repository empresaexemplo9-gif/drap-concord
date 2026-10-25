import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

// Atalho usado em notificações: leva cada conta para a sua lista de chamadas.
export default async function Chamadas() {
  const user = await requireUser(undefined, "/entrar?next=/chamadas");
  redirect(user.role === "CLIENT" ? "/minha-conta/chamadas" : user.role === "PLATFORM_ADMIN" && !user.memberships.length ? "/admin/perfis" : "/app/chamadas");
}
