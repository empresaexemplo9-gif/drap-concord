import { notFound } from "next/navigation";
import { ButtonLink, Card, Logo } from "@/components/ui";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { dateLong, modalityLabel, time } from "@/lib/format";
import { directionLinks } from "@/lib/directions";
import { brandName, parseBrand } from "@/lib/brand";

export const metadata = { title: "Agendamento solicitado", robots: { index: false } };

export default async function Agendado({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const user = await getUser();
  const appt = id && user ? await db.appointment.findFirst({ where: { id, client: { userId: user.id } }, include: { service: true, professional: true } }) : null;
  if (!appt) notFound();
  const tz = appt.professional.timezone;
  return (
    <div className="gutter grid items-center gap-8 py-16 lg:grid-cols-2">
      <div className="rounded-2xl border border-line bg-card/70 p-6 shadow-soft sm:p-8">
        <Logo size={44} />
        <h1 className="mt-6 text-3xl font-semibold sm:text-4xl">Pedido enviado!</h1>
        <p className="mt-2 text-lg text-muted">{appt.professional.displayName} recebeu seu agendamento. Você é avisado(a) aqui no portal quando houver novidades.</p>
        {parseBrand(appt.professional.brand).confirmationMessage && (
          <div className="mt-6 rounded-2xl border border-line bg-card p-4">
            <p className="text-sm font-semibold text-accent">Recado de {brandName(appt.professional)}</p>
            <p className="mt-1 whitespace-pre-line">{parseBrand(appt.professional.brand).confirmationMessage}</p>
          </div>
        )}
        <ButtonLink href="/minha-conta" className="mt-8">Ver meus agendamentos</ButtonLink>
      </div>
      <Card>
        <p className="font-semibold">{appt.service.name}</p>
        <p className="capitalize">{dateLong(appt.startsAt, tz)}, às {time(appt.startsAt, tz)}</p>
        <p className="text-sm text-muted">{modalityLabel[appt.modality]} · com {appt.professional.displayName}</p>
        {appt.modality === "IN_PERSON" && appt.professional.address && (
          <div className="mt-3 border-t border-line pt-3 text-sm">
            <p>📍 {appt.professional.address}</p>
            {appt.professional.latitude != null && appt.professional.longitude != null && (
              <p className="mt-2 flex flex-wrap gap-3">
                {directionLinks({ lat: appt.professional.latitude, lng: appt.professional.longitude, address: appt.professional.address }).map((l) => (
                  <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary">{l.label}</a>
                ))}
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
