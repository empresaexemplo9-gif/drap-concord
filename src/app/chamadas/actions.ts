"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CallError, createRoom } from "@/lib/calls";

const back = (to: string, msg: string): never => redirect(`${to}${to.includes("?") ? "&" : "?"}erro=${encodeURIComponent(msg)}`);

/** Cria a sala, toca para cada convidado e leva o dono direto para a chamada. */
export async function startCall(form: FormData) {
  const user = await requireUser();
  const from = String(form.get("from") ?? "/chamadas");
  const appointmentId = String(form.get("appointmentId") ?? "") || undefined;
  if (appointmentId) {
    const ok = await db.appointment.findFirst({ where: { id: appointmentId, OR: [{ org: { members: { some: { userId: user.id } } } }, { client: { userId: user.id } }] } });
    if (!ok) back(from, "Atendimento não encontrado.");
  }
  let roomId = "";
  try {
    const room = await createRoom(user, {
      title: String(form.get("title") ?? ""),
      kind: form.get("kind") === "AUDIO" ? "AUDIO" : "VIDEO",
      participantIds: form.getAll("participants").map(String),
      appointmentId,
    });
    roomId = room.id;
  } catch (e) {
    if (e instanceof CallError) back(from, e.message);
    throw e;
  }
  redirect(`/chamadas/${roomId}`);
}

/** Liga de novo para as mesmas pessoas de uma sala encerrada. */
export async function redial(form: FormData) {
  const user = await requireUser();
  const old = await db.callRoom.findFirst({ where: { id: String(form.get("roomId")), participants: { some: { userId: user.id } } }, include: { participants: true } });
  if (!old) redirect("/chamadas");
  const room = await createRoom(user, { title: old!.title, kind: old!.kind === "AUDIO" ? "AUDIO" : "VIDEO", participantIds: old!.participants.map((p) => p.userId), appointmentId: old!.appointmentId ?? undefined }).catch((e) => {
    if (e instanceof CallError) back("/chamadas", e.message);
    throw e;
  });
  redirect(`/chamadas/${room.id}`);
}
