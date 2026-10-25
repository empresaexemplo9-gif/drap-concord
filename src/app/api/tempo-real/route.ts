import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { eventsSince, lastEventId, pruneEvents } from "@/lib/realtime";
import { RING_SECONDS } from "@/lib/calls";

// Canal de eventos em tempo real da conta (Server-Sent Events). O navegador
// mantém a conexão aberta; a cada poucos minutos ela é renovada e retoma do
// último evento recebido (Last-Event-ID), sem perder nada.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const STREAM_MS = 240_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return new Response("Não autenticado", { status: 401 });
  const resume = req.headers.get("last-event-id");
  let last = resume && /^\d+$/.test(resume) ? BigInt(resume) : await lastEventId(user.id);

  // Conexão nova: chamadas que ainda estão tocando para a pessoa.
  const ringing = resume
    ? []
    : await db.callParticipant.findMany({
        where: { userId: user.id, state: "INVITED", invitedAt: { gt: new Date(Date.now() - RING_SECONDS * 1000) }, room: { status: "ACTIVE" } },
        include: { room: { include: { owner: { select: { id: true, name: true } } } } },
      });

  const enc = new TextEncoder();
  // A conexão fecha quando o navegador sai; o laço para na hora (não fica consultando o banco à toa).
  let closed = false;
  req.signal.addEventListener("abort", () => (closed = true));
  const stream = new ReadableStream({
    cancel() {
      closed = true;
    },
    async start(controller) {
      const send = (s: string) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(s));
        } catch {
          closed = true;
        }
      };
      send("retry: 1500\n\n");
      for (const r of ringing) {
        const left = Math.max(5, RING_SECONDS - Math.round((Date.now() - r.invitedAt.getTime()) / 1000));
        send(`data: ${JSON.stringify({ type: "call.ring", data: { roomId: r.roomId, title: r.room.title, kind: r.room.kind, from: r.room.owner, ringSeconds: left } })}\n\n`);
      }
      const started = Date.now();
      let lastActivity = 0;
      let lastPing = Date.now();
      try {
        while (!closed && Date.now() - started < STREAM_MS) {
          const events = await eventsSince(user.id, last);
          for (const e of events) {
            last = e.id;
            send(`id: ${e.id}\ndata: ${JSON.stringify({ type: e.type, data: e.data })}\n\n`);
          }
          if (events.length) lastActivity = Date.now();
          if (Date.now() - lastPing > 15_000) {
            send(": ping\n\n");
            lastPing = Date.now();
          }
          if (Math.random() < 0.002) await pruneEvents();
          // Mais rápido durante sinalização de chamada; mais econômico parado.
          await sleep(Date.now() - lastActivity < 15_000 ? 300 : 1000);
        }
      } catch {
        // conexão caiu: o navegador reconecta sozinho
      }
      try {
        controller.close();
      } catch {}
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
