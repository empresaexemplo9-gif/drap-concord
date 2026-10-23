import { notFound } from "next/navigation";
import { ButtonLink, Card, Logo } from "@/components/ui";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { dateLong, modalityLabel, time } from "@/lib/format";

export const metadata = { title: "Agendamento solicitado", robots: { index: false } };

export default async function Agendado({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const user = await getUser();
  const appt = id && user ? await db.appointment.findFirst({ where: { id, client: { userId: user.id } }, include: { service: true, professional: true } }) : null;
  if (!appt) notFound();
  const tz = appt.professional.timezone;
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <Logo size={44} className="mx-auto" />
      <h1 className="mt-6 text-3xl font-semibold">Pedido enviado!</h1>
      <p className="mt-2 text-muted">{appt.professional.displayName} recebeu seu agendamento. Você é avisado(a) aqui no portal quando houver novidades.</p>
      <Card className="mt-8 text-left">
        <p className="font-semibold">{appt.service.name}</p>
        <p className="capitalize">{dateLong(appt.startsAt, tz)}, às {time(appt.startsAt, tz)}</p>
        <p className="text-sm text-muted">{modalityLabel[appt.modality]} · com {appt.professional.displayName}</p>
      </Card>
      <ButtonLink href="/minha-conta" className="mt-8">Ver meus agendamentos</ButtonLink>
    </div>
  );
}
