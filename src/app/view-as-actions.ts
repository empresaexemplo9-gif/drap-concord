"use server";

import { redirect } from "next/navigation";
import { getImpersonator, stopActAs } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function stopViewAs() {
  const admin = await getImpersonator();
  await stopActAs();
  if (admin) await audit({ userId: admin.id, action: "admin.view_as.stop", entity: "User", entityId: admin.id });
  redirect("/admin/ver-como");
}
