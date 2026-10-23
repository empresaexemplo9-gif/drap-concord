"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, destroySession } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { BookingError, cancelByClient, confirmByClient, reschedule } from "@/lib/booking";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function confirm(form: FormData) {
  const user = await requireUser(["CLIENT"]);
  await confirmByClient(str(form, "id"), user.id);
  revalidatePath("/minha-conta");
}

export async function cancel(form: FormData) {
  const user = await requireUser(["CLIENT"]);
  try {
    await cancelByClient(str(form, "id"), user.id, str(form, "reason") || undefined);
  } catch (e) {
    if (e instanceof BookingError) redirect(`/minha-conta?erro=${encodeURIComponent(e.message)}`);
    throw e;
  }
  redirect("/minha-conta?ok=cancelado");
}

export async function rescheduleClient(form: FormData) {
  const user = await requireUser(["CLIENT"]);
  const id = str(form, "id");
  const appt = await db.appointment.findFirst({ where: { id, client: { userId: user.id } } });
  if (!appt) redirect("/minha-conta");
  try {
    await reschedule(id, new Date(str(form, "start")), { userId: user.id, byProfessional: false });
  } catch (e) {
    if (e instanceof BookingError) redirect(`/minha-conta/remarcar/${id}?erro=${encodeURIComponent(e.message)}`);
    throw e;
  }
  redirect("/minha-conta?ok=remarcado");
}

export async function review(form: FormData) {
  const user = await requireUser(["CLIENT"]);
  const appt = await db.appointment.findFirst({ where: { id: str(form, "id"), status: "DONE", client: { userId: user.id } } });
  if (!appt) redirect("/minha-conta");
  const rating = Math.min(5, Math.max(1, Number(str(form, "rating")) || 5));
  // Avaliações passam por moderação antes de aparecer na vitrine.
  await db.review.create({ data: { professionalId: appt!.professionalId, clientId: appt!.clientId, rating, comment: str(form, "comment") || null } });
  redirect("/minha-conta?ok=avaliado");
}

export async function markRead() {
  const user = await requireUser(["CLIENT"]);
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/minha-conta");
}

export async function deleteAccount(form: FormData) {
  const user = await requireUser(["CLIENT"]);
  if (str(form, "confirm") !== "EXCLUIR") redirect("/minha-conta/dados?erro=Digite EXCLUIR para confirmar.");
  await audit({ userId: user.id, action: "lgpd.account_deleted", entity: "User", entityId: user.id });
  // Desvincula: registros que o profissional é obrigado a guardar ficam com ele (Client.userId vira nulo).
  await destroySession();
  await db.user.delete({ where: { id: user.id } });
  redirect("/?conta=excluida");
}
