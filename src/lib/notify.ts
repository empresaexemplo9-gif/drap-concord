import { db } from "./db";

// Central de notificações in-app. Push/e-mail/WhatsApp entram como canais
// adicionais (ver docs/ROADMAP.md); por ora tudo passa pela central.
export async function notify(userId: string | null | undefined, title: string, body: string, link?: string) {
  if (!userId) return;
  await db.notification.create({ data: { userId, title, body, link } });
}
