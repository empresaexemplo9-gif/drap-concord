import { notFound } from "next/navigation";
import { Card, Field, PageHeader, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { review } from "../../actions";

export const metadata = { title: "Avaliar" };

export default async function Avaliar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(["CLIENT"]);
  const appt = await db.appointment.findFirst({ where: { id, status: "DONE", client: { userId: user.id } }, include: { professional: true, service: true } });
  if (!appt) notFound();
  return (
    <>
      <PageHeader title={`Como foi com ${appt.professional.displayName.split(" ")[0]}?`} subtitle={appt.service.name} />
      <Card>
        <form action={review} className="space-y-5">
          <input type="hidden" name="id" value={appt.id} />
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Sua nota</legend>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="inline-flex size-12 cursor-pointer items-center justify-center rounded-xl border border-line text-lg has-[:checked]:border-gold has-[:checked]:bg-warning-bg">
                  <input type="radio" name="rating" value={n} defaultChecked={n === 5} className="sr-only" />
                  <span aria-hidden>★</span><span className="sr-only">{n} estrelas</span>
                  <span className="ml-0.5 text-sm">{n}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Comentário (opcional)" htmlFor="comment" hint="Aparece na página do profissional, só com seu primeiro nome."><Textarea id="comment" name="comment" /></Field>
          <SubmitButton>Enviar avaliação</SubmitButton>
        </form>
      </Card>
    </>
  );
}
