import { z } from "zod";
import { getUser } from "@/lib/auth";
import { CallError, decline, end, heartbeat, invite, join, leave, participantView, roomFor, signal } from "@/lib/calls";

// Ações de uma chamada em andamento, usadas pela tela da chamada.
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("join") }),
  z.object({ action: z.literal("leave") }),
  z.object({ action: z.literal("decline") }),
  z.object({ action: z.literal("end") }),
  z.object({ action: z.literal("heartbeat") }),
  z.object({ action: z.literal("invite"), userIds: z.array(z.string()).min(1).max(100) }),
  z.object({ action: z.literal("signal"), to: z.string(), payload: z.record(z.unknown()) }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  const raw = await req.text();
  const parsed = body.safeParse(raw ? JSON.parse(raw) : {});
  if (!parsed.success) return Response.json({ error: "Pedido inválido" }, { status: 400 });
  const b = parsed.data;
  try {
    switch (b.action) {
      case "join": {
        await join(user.id, id);
        const room = (await roomFor(user.id, id))!;
        return Response.json({ participants: participantView(room) });
      }
      case "leave":
        await leave(user.id, id);
        break;
      case "decline":
        await decline(user.id, id);
        break;
      case "end":
        await end(id, user.id);
        break;
      case "heartbeat":
        await heartbeat(user.id, id);
        break;
      case "invite":
        await invite(user, id, b.userIds);
        break;
      case "signal":
        await signal(user.id, id, b.to, b.payload);
        break;
    }
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof CallError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
