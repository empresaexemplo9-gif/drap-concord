import Link from "next/link";
import { Alert, Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { SlotPicker } from "@/components/slot-picker";
import { SubmitButton } from "@/components/submit-button";
import { requireProfessional } from "@/lib/auth";
import { tenant } from "@/lib/tenant";
import { availableSlots } from "@/lib/booking";
import { professionalConfig } from "@/lib/profiles/registry";
import { modalityLabel, money } from "@/lib/format";
import { createAppointment } from "../actions";

export const metadata = { title: "Novo agendamento" };

export default async function Agendar({ searchParams }: { searchParams: Promise<{ servico?: string; cliente?: string; erro?: string }> }) {
  const { professional, orgId } = await requireProfessional();
  const { servico, cliente, erro } = await searchParams;
  const cfg = await professionalConfig(professional);
  const t = cfg.terminology;
  const services = (await tenant(orgId).services.list(professional.id)).filter((s) => s.active);
  const clients = await tenant(orgId).clients.list();
  const service = services.find((s) => s.id === servico);
  const slots = service ? await availableSlots(professional.id, service.id, 21) : [];

  return (
    <>
      <PageHeader title="Novo agendamento" subtitle={`Marque um(a) ${t.appointment.singular} para um(a) ${t.client.singular}.`} />
      {erro && <div className="mb-4"><Alert tone="danger">{erro}</Alert></div>}

      {!service ? (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">1. Qual serviço?</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {services.map((s) => (
              <Link key={s.id} href={`/app/agendar?servico=${s.id}${cliente ? `&cliente=${cliente}` : ""}`} className="rounded-xl border border-line p-4 hover:border-primary">
                <p className="font-semibold">{s.name}</p>
                <p className="text-sm text-muted">{s.durationMin} min · {modalityLabel[s.modality]} · {money(s.priceCents)}</p>
              </Link>
            ))}
          </div>
        </Card>
      ) : (
        <form action={createAppointment} className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          <input type="hidden" name="serviceId" value={service.id} />
          <Card className="h-fit space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Serviço</p>
                <p className="font-semibold">{service.name} · {service.durationMin} min</p>
              </div>
              <Link href="/app/agendar" className="text-sm font-semibold text-primary">Trocar</Link>
            </div>
            <Field label={`${t.client.singular[0].toUpperCase()}${t.client.singular.slice(1)}`} htmlFor="clientId">
              <Select id="clientId" name="clientId" defaultValue={cliente ?? ""}>
                <option value="novo">+ Novo(a) {t.client.singular}</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <details className="rounded-xl bg-surface p-3" open={!cliente}>
              <summary className="cursor-pointer text-sm font-semibold">Dados do(a) novo(a) {t.client.singular}</summary>
              <div className="mt-3 space-y-3">
                <Field label="Nome" htmlFor="clientName"><Input id="clientName" name="clientName" /></Field>
                <Field label="E-mail" htmlFor="clientEmail"><Input id="clientEmail" name="clientEmail" type="email" /></Field>
                <Field label="Telefone" htmlFor="clientPhone"><Input id="clientPhone" name="clientPhone" type="tel" /></Field>
              </div>
            </details>
            <Field label="Observações" htmlFor="notes"><Textarea id="notes" name="notes" /></Field>
          </Card>
          <Card className="space-y-5">
            <h2 className="text-lg font-semibold">Horários livres</h2>
            <SlotPicker slots={slots} tz={professional.timezone} required={false} />
            <details className="rounded-xl bg-surface p-3">
              <summary className="cursor-pointer text-sm font-semibold">Encaixar em outro horário</summary>
              <div className="mt-3"><Field label="Data e hora" htmlFor="manual" hint="Use para encaixes fora da disponibilidade."><Input id="manual" name="manual" type="datetime-local" /></Field></div>
            </details>
            <SubmitButton className="w-full" pendingText="Agendando…">Confirmar agendamento</SubmitButton>
          </Card>
        </form>
      )}
    </>
  );
}
