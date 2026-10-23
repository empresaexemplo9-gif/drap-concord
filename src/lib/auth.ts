import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { db } from "./db";

const COOKIE = "concord_session";
const TTL_DAYS = 30;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw: string, h: string) => bcrypt.compare(pw, h);

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_DAYS * 86_400_000);
  await db.session.create({ data: { id: hash(token), userId, expiresAt } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: hash(token) } });
  jar.delete(COOKIE);
}

export async function getUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: hash(token) },
    include: { user: { include: { memberships: true, professional: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getUser>>>;

export async function requireUser(roles?: UserRole[], next = "/entrar") {
  const user = await getUser();
  if (!user) redirect(next);
  if (roles && !roles.includes(user.role)) redirect("/");
  return user;
}

/** Profissional logado + organização (tenant) a que pertence. */
export async function requireProfessional() {
  const user = await requireUser(["PROFESSIONAL", "PLATFORM_ADMIN"]);
  if (!user.professional) redirect("/onboarding");
  const membership = user.memberships.find((m) => m.orgId === user.professional!.orgId);
  if (!membership) redirect("/onboarding");
  return { user, professional: user.professional, orgId: user.professional.orgId, memberRole: membership.role };
}
