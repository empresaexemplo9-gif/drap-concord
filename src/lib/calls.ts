import "server-only";
import { db } from "./db";
import { emit } from "./realtime";
import { notify } from "./notify";

// Chamadas de áudio e vídeo da plataforma. A mídia vai direto entre os
// navegadores (WebRTC); o servidor só guarda a sala, quem foi convidado e
// repassa a sinalização. O dono convida quantas pessoas quiser e cada
// convidado recebe a chamada tocando na própria conta.

export class CallError extends Error {}

export type CallUser = { id: string; name: string; role: string; memberships: { orgId: string }[] };
export type Contact = { id: string; name: string; email: string; label: string };

/** Ring vale por este tempo; depois a chamada aparece como perdida. */
export const RING_SECONDS = 45;
/** Sem sinal de vida por este tempo, o participante é considerado fora da chamada. */
export const PRESENCE_SECONDS = 40;

/**
 * Com quem a pessoa pode falar: profissional e equipe falam com os clientes
 * que têm conta e com a própria equipe; clientes falam com seus profissionais.
 */
export async function contactsFor(user: CallUser): Promise<Contact[]> {
  const orgIds = user.memberships.map((m) => m.orgId);
  const [clients, team, pros] = await Promise.all([
    orgIds.length
      ? db.client.findMany({ where: { orgId: { in: orgIds }, userId: { not: null } }, select: { user: { select: { id: true, name: true, email: true, isSandbox: true } } } })
      : [],
    orgIds.length
      ? db.membership.findMany({ where: { orgId: { in: orgIds } }, select: { role: true, user: { select: { id: true, name: true, email: true, isSandbox: true } } } })
      : [],
    db.client.findMany({
      where: { userId: user.id },
      select: { org: { select: { name: true, members: { where: { role: "OWNER" }, select: { user: { select: { id: true, name: true, email: true, isSandbox: true } } } } } } },
    }),
  ]);
  const out = new Map<string, Contact>();
  const add = (u: { id: string; name: string; email: string; isSandbox: boolean } | null, label: string) => {
    if (u && u.id !== user.id && !u.isSandbox && !out.has(u.id)) out.set(u.id, { id: u.id, name: u.name, email: u.email, label });
  };
  team.forEach((m) => add(m.user, m.role === "OWNER" ? "Profissional" : "Equipe"));
  clients.forEach((c) => add(c.user, "Cliente"));
  pros.forEach((c) => c.org.members.forEach((m) => add(m.user, "Profissional")));
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

async function assertContacts(user: CallUser, ids: string[]) {
  const allowed = new Set((await contactsFor(user)).map((c) => c.id));
  const bad = ids.filter((id) => !allowed.has(id));
  if (bad.length) throw new CallError("Você só pode chamar seus contatos na plataforma.");
}

const roomInclude = { participants: { include: { user: { select: { id: true, name: true } } }, orderBy: { invitedAt: "asc" as const } }, owner: { select: { id: true, name: true } } };

/** Sala, se a pessoa faz parte dela. */
export async function roomFor(userId: string, roomId: string) {
  const room = await db.callRoom.findUnique({ where: { id: roomId }, include: roomInclude });
  if (!room || !room.participants.some((p) => p.userId === userId)) return null;
  return room;
}

export type Room = NonNullable<Awaited<ReturnType<typeof roomFor>>>;

/** Estado para a tela: quem está na chamada, chamando, recusou ou perdeu. */
export function participantView(room: Room) {
  const now = Date.now();
  return room.participants.map((p) => {
    let state = p.state;
    if (state === "JOINED" && p.lastSeenAt && now - p.lastSeenAt.getTime() > PRESENCE_SECONDS * 1000) state = "LEFT";
    if (state === "INVITED" && now - p.invitedAt.getTime() > RING_SECONDS * 1000) state = "MISSED";
    return { userId: p.userId, name: p.user.name, state, owner: p.userId === room.ownerId };
  });
}

async function broadcastParticipants(roomId: string) {
  const room = await db.callRoom.findUniqueOrThrow({ where: { id: roomId }, include: roomInclude });
  await emit(room.participants.map((p) => p.userId), "call.participants", { roomId, participants: participantView(room) });
}

async function ring(room: { id: string; title: string; kind: string }, caller: { id: string; name: string }, userIds: string[]) {
  if (!userIds.length) return;
  await emit(userIds, "call.ring", { roomId: room.id, title: room.title, kind: room.kind, from: { id: caller.id, name: caller.name }, ringSeconds: RING_SECONDS });
  const what = room.kind === "VIDEO" ? "chamada de vídeo" : "chamada de áudio";
  await Promise.all(userIds.map((id) => notify(id, `${caller.name} está te chamando`, `${what[0].toUpperCase()}${what.slice(1)}: ${room.title}.`, `/chamadas/${room.id}`)));
}

export async function createRoom(user: CallUser, input: { title?: string; kind: "AUDIO" | "VIDEO"; participantIds: string[]; appointmentId?: string }) {
  const ids = [...new Set(input.participantIds)].filter((id) => id !== user.id);
  if (!ids.length) throw new CallError("Escolha pelo menos uma pessoa para chamar.");
  await assertContacts(user, ids);
  const names = await db.user.findMany({ where: { id: { in: ids } }, select: { name: true } });
  const title = input.title?.trim() || (names.length === 1 ? `${user.name} e ${names[0].name}` : `Sala de ${user.name}`);
  const room = await db.callRoom.create({
    data: {
      title: title.slice(0, 120),
      kind: input.kind,
      ownerId: user.id,
      appointmentId: input.appointmentId,
      participants: { create: [{ userId: user.id, state: "JOINED", joinedAt: new Date(), lastSeenAt: new Date() }, ...ids.map((userId) => ({ userId }))] },
    },
  });
  await ring(room, user, ids);
  return room;
}

/** Dono (ou quem está na sala) adiciona mais gente, inclusive durante a chamada. */
export async function invite(user: CallUser, roomId: string, participantIds: string[]) {
  const room = await roomFor(user.id, roomId);
  if (!room || room.status !== "ACTIVE") throw new CallError("Sala encerrada.");
  if (room.ownerId !== user.id) throw new CallError("Só quem criou a sala adiciona pessoas.");
  const ids = [...new Set(participantIds)].filter((id) => id !== user.id);
  await assertContacts(user, ids);
  for (const userId of ids) {
    await db.callParticipant.upsert({
      where: { roomId_userId: { roomId, userId } },
      update: { state: "INVITED", invitedAt: new Date(), leftAt: null },
      create: { roomId, userId },
    });
  }
  await ring(room, user, ids);
  await broadcastParticipants(roomId);
}

export async function join(userId: string, roomId: string) {
  const room = await roomFor(userId, roomId);
  if (!room) throw new CallError("Você não faz parte desta sala.");
  if (room.status !== "ACTIVE") throw new CallError("Esta chamada já terminou.");
  await db.callParticipant.update({ where: { roomId_userId: { roomId, userId } }, data: { state: "JOINED", joinedAt: new Date(), lastSeenAt: new Date(), leftAt: null } });
  const others = room.participants.filter((p) => p.userId !== userId).map((p) => p.userId);
  await emit(others, "call.joined", { roomId, userId });
  await emit(userId, "call.cancel", { roomId, reason: "answered" }); // para de tocar nos outros aparelhos da pessoa
  await broadcastParticipants(roomId);
  return room;
}

export async function heartbeat(userId: string, roomId: string) {
  await db.callParticipant.updateMany({ where: { roomId, userId, state: "JOINED" }, data: { lastSeenAt: new Date() } });
}

export async function leave(userId: string, roomId: string) {
  const room = await roomFor(userId, roomId);
  if (!room) return;
  await db.callParticipant.update({ where: { roomId_userId: { roomId, userId } }, data: { state: "LEFT", leftAt: new Date() } });
  await emit(room.participants.filter((p) => p.userId !== userId).map((p) => p.userId), "call.left", { roomId, userId });
  // Sem ninguém na sala, ela encerra (e para de tocar para quem não atendeu).
  const fresh = await db.callRoom.findUniqueOrThrow({ where: { id: roomId }, include: roomInclude });
  if (!participantView(fresh).some((p) => p.state === "JOINED")) await end(roomId);
  else await broadcastParticipants(roomId);
}

export async function decline(userId: string, roomId: string) {
  const room = await roomFor(userId, roomId);
  if (!room) return;
  await db.callParticipant.updateMany({ where: { roomId, userId, state: "INVITED" }, data: { state: "DECLINED" } });
  await emit(userId, "call.cancel", { roomId, reason: "declined" });
  await broadcastParticipants(roomId);
}

export async function end(roomId: string, byUserId?: string) {
  const room = await db.callRoom.findUniqueOrThrow({ where: { id: roomId }, include: roomInclude });
  if (byUserId && room.ownerId !== byUserId) throw new CallError("Só quem criou a sala pode encerrar para todos.");
  if (room.status === "ENDED") return;
  await db.callRoom.update({ where: { id: roomId }, data: { status: "ENDED", endedAt: new Date() } });
  const missed = room.participants.filter((p) => p.state === "INVITED");
  await db.callParticipant.updateMany({ where: { roomId, state: { in: ["JOINED", "INVITED"] } }, data: { state: "LEFT", leftAt: new Date() } });
  const all = room.participants.map((p) => p.userId);
  await emit(all, "call.ended", { roomId });
  await emit(all, "call.cancel", { roomId, reason: "ended" });
  await Promise.all(missed.map((p) => notify(p.userId, "Chamada perdida", `${room.owner.name} te chamou: ${room.title}.`, "/chamadas")));
}

/** Repasse da sinalização WebRTC (oferta, resposta, candidatos ICE) entre duas pessoas da mesma sala. */
export async function signal(fromId: string, roomId: string, toId: string, payload: unknown) {
  const room = await roomFor(fromId, roomId);
  if (!room || room.status !== "ACTIVE" || !room.participants.some((p) => p.userId === toId)) throw new CallError("Destino inválido.");
  await emit(toId, "call.signal", { roomId, from: fromId, payload: payload as Record<string, unknown> });
}

/**
 * Servidores ICE. STUN público sempre; TURN (para redes que bloqueiam conexão
 * direta) via Cloudflare (credenciais temporárias) ou servidor próprio.
 */
export async function iceServers(): Promise<RTCIceServer[]> {
  const servers: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }];
  const { CF_TURN_KEY_ID: keyId, CF_TURN_API_TOKEN: token, TURN_URLS, TURN_USERNAME, TURN_CREDENTIAL } = process.env;
  if (keyId && token) {
    try {
      const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: 6 * 3600 }),
        cache: "no-store",
      });
      if (r.ok) {
        const { iceServers: ice } = (await r.json()) as { iceServers: RTCIceServer | RTCIceServer[] };
        servers.push(...(Array.isArray(ice) ? ice : [ice]));
      }
    } catch {
      // Sem TURN, a chamada ainda funciona na maioria das redes.
    }
  } else if (TURN_URLS && TURN_USERNAME && TURN_CREDENTIAL) {
    servers.push({ urls: TURN_URLS.split(",").map((u) => u.trim()), username: TURN_USERNAME, credential: TURN_CREDENTIAL });
  }
  return servers;
}

/** Chamadas da pessoa (ativas primeiro), para a lista. */
export async function myRooms(userId: string) {
  const rooms = await db.callRoom.findMany({
    where: { participants: { some: { userId } } },
    include: roomInclude,
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  const out = rooms.map((r) => ({ ...r, view: participantView(r) }));
  // Sala abandonada (ninguém mais conectado nem sendo chamado) é encerrada.
  for (const r of out) {
    if (r.status === "ACTIVE" && !r.view.some((p) => p.state === "JOINED" || p.state === "INVITED")) {
      await end(r.id);
      r.status = "ENDED";
    }
  }
  return out;
}
