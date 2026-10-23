import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Card, PageHeader } from "@/components/ui";
import { SlotPicker } from "@/components/slot-picker";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { availableSlots, clientCanChange } from "@/lib/booking";
import { dateLong, time } from "@/lib/format";
import { rescheduleClient } from "../../actions";

export const metadata = { title: "Reagendar" };

export default async function Remarcar({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { id } = await params;
  const { erro } = await searchParams;
  const user = await requireUser(["CLIENT"]);
  const appt = await db.appointment.findFirst({ where: { id, client: { userId: user.id }, status: { in: ["PENDING", "CONFIRMED"] } }, include: { service: true, professional: true } });
  if (!appt) notFound();
  const tz = appt.professional.timezone;
  const policy = await clientCanChange(appt);
  const slots = policy.allowed ? await availableSlots(appt.professionalId, appt.serviceId, 21) : [];
  return (
    <>
      <Link href="/minha-conta" className="text-sm font-semibold text-primary">← Voltar</Link>
      <PageHeader title="Escolha um novo horário" subtitle={`Atual: ${dateLong(appt.startsAt, tz)}, ${time(appt.startsAt, tz)} · ${appt.service.name}`} />
      {erro && <div className="mb-4"><Alert tone="danger">{erro}</Alert></div>}
      {!policy.allowed ? (
        <Alert tone="warning">Remarcações pelo app só até {policy.minHours}h antes. Fale com {appt.professional.displayName} pelo contato combinado.</Alert>
      ) : (
        <Card>
          <form action={rescheduleClient} className="space-y-5">
            <input type="hidden" name="id" value={appt.id} />
            <p className="text-sm text-muted">Mostramos apenas horários realmente livres.</p>
            <SlotPicker slots={slots} tz={tz} max={10} />
            <SubmitButton className="w-full" pendingText="Remarcando…">Confirmar novo horário</SubmitButton>
          </form>
        </Card>
      )}
    </>
  );
}
