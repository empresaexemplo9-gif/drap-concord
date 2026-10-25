"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfessional } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { profileOverridesSchema } from "@/lib/profiles/schema";
import { geocode } from "@/lib/geo";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(str(f, k)));
  return Number.isFinite(n) && str(f, k) !== "" ? Math.min(max, Math.max(min, n)) : fallback;
};

export async function saveAttendance(form: FormData) {
  const { professional, user, memberRole } = await requireProfessional();
  if (memberRole !== "OWNER") redirect(`/app/atendimento?erro=${encodeURIComponent("Só o titular da conta pode alterar o modo de atendimento.")}`);
  const current = profileOverridesSchema.parse(professional.overrides ?? {});
  const careTypes = form.getAll("careTypes").map(String);
  const offered = form.getAll("careTypeKeys").map(String);
  const overrides = profileOverridesSchema.parse({
    ...current,
    terminology: {
      ...(current.terminology ?? {}),
      client: { singular: str(form, "clientSingular"), plural: str(form, "clientPlural") },
      appointment: { singular: str(form, "apptSingular"), plural: str(form, "apptPlural") },
      ...(str(form, "record") ? { record: str(form, "record") } : {}),
      ...(str(form, "professional") ? { professional: str(form, "professional") } : {}),
    },
    cancellationPolicy: { minHoursBefore: int(form, "minHours", 0, 720, 24) },
    booking: {
      confirmation: form.get("confirmation") === "AUTO" ? "AUTO" : "MANUAL",
      minNoticeHours: int(form, "minNoticeHours", 0, 720, 0),
      maxAdvanceDays: int(form, "maxAdvanceDays", 1, 365, 60),
      triage: form.get("triage") === "on",
      careTypesOff: offered.filter((k) => !careTypes.includes(k)),
    },
  });
  for (const k of ["clientSingular", "clientPlural", "apptSingular", "apptPlural"]) {
    if (!str(form, k)) redirect(`/app/atendimento?erro=${encodeURIComponent("Preencha os nomes de cliente e atendimento.")}`);
  }
  // Local: o ponto escolhido no mapa; se só digitou o endereço, localiza automaticamente.
  const address = str(form, "address").slice(0, 200) || null;
  let latitude = Number(str(form, "latitude")) || null;
  let longitude = Number(str(form, "longitude")) || null;
  if (address && (latitude == null || longitude == null)) {
    const [first] = await geocode(address);
    latitude = first?.lat ?? null;
    longitude = first?.lng ?? null;
  }
  if (!address) latitude = longitude = null;
  const radius = str(form, "serviceRadiusKm");
  await db.professional.update({
    where: { id: professional.id },
    data: {
      overrides,
      bufferMin: int(form, "bufferMin", 0, 240, professional.bufferMin),
      address,
      latitude,
      longitude,
      serviceRadiusKm: radius ? int(form, "serviceRadiusKm", 0, 300, 0) || null : null,
    },
  });
  await audit({ orgId: professional.orgId, userId: user.id, action: "attendance.updated", entity: "Professional", entityId: professional.id });
  revalidatePath("/", "layout");
  redirect("/app/atendimento?ok=1");
}
