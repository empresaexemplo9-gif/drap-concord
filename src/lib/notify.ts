import { db } from "./db";
import { emit } from "./realtime";

// Central de notificações in-app, entregue também em tempo real (sino e aviso
// na tela). E-mail/WhatsApp entram como canais adicionais (ver docs/ROADMAP.md).
export async function notify(userId: string | null | undefined, title: string, body: string, link?: string) {
  if (!userId) return;
  const n = await db.notification.create({ data: { userId, title, body, link } });
  await emit(userId, "notification", { id: n.id, title, body, link: link ?? null });
}
