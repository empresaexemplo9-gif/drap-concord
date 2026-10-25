import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

// Eventos em tempo real por usuário. Ficam numa fila no banco e são entregues
// pelo canal SSE (/api/tempo-real), que funciona em qualquer instância do
// servidor. Usados para tocar chamadas, sinalização WebRTC e notificações.

export type RealtimeType =
  | "notification"
  | "call.ring"
  | "call.cancel"
  | "call.joined"
  | "call.left"
  | "call.ended"
  | "call.participants"
  | "call.signal";

export async function emit(userIds: string | string[], type: RealtimeType, data: Record<string, unknown>) {
  const ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])].filter(Boolean);
  if (!ids.length) return;
  await db.realtimeEvent.createMany({ data: ids.map((userId) => ({ userId, type, data: data as Prisma.InputJsonValue })) });
}

export async function eventsSince(userId: string, lastId: bigint) {
  return db.realtimeEvent.findMany({ where: { userId, id: { gt: lastId } }, orderBy: { id: "asc" }, take: 200 });
}

export async function lastEventId(userId: string) {
  const last = await db.realtimeEvent.findFirst({ where: { userId }, orderBy: { id: "desc" }, select: { id: true } });
  return last?.id ?? BigInt(0);
}

/** Eventos são efêmeros: depois de alguns minutos não servem mais para nada. */
export async function pruneEvents(olderThanMin = 15) {
  await db.realtimeEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - olderThanMin * 60_000) } } });
}
