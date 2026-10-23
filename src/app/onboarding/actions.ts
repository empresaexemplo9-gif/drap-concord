"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { applyProfile } from "@/lib/onboarding";

export async function finishOnboarding(form: FormData) {
  const user = await requireUser(["PROFESSIONAL", "PLATFORM_ADMIN"]);
  if (user.professional) redirect("/app");
  const profileKey = String(form.get("profile") ?? "");
  const displayName = String(form.get("displayName") ?? "").trim() || user.name;
  await applyProfile({
    userId: user.id,
    profileKey,
    displayName,
    city: String(form.get("city") ?? "").trim() || undefined,
    registryNumber: String(form.get("registry") ?? "").trim() || undefined,
  });
  redirect("/app?bemvindo=1");
}
