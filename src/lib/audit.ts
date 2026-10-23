import type { Prisma } from "@prisma/client";
import { db } from "./db";

export async function audit(entry: {
  orgId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Prisma.InputJsonValue;
}) {
  await db.auditLog.create({ data: { ...entry, orgId: entry.orgId ?? null, userId: entry.userId ?? null } });
}
