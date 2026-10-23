import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Card, Field, Input } from "@/components/ui";
import { DynamicFields } from "@/components/dynamic-fields";
import { SlotPicker } from "@/components/slot-picker";
import { SubmitButton } from "@/components/submit-button";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { availableSlots } from "@/lib/booking";
import { professionalConfig } from "@/lib/profiles/registry";
import { dateLong, modalityLabel, money, time } from "@/lib/format";
import { bookPublic } from "./actions";

export const metadata = { title: "Agendar", robots: { index: false } };

export default async function AgendarPublico({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ servico?: string; horario?: string; erro?: string }> }) {
  const { slug } = await params;
  const { servico, horario, erro } = await searchParams;
  const pro = await db.professional.findFirst({ where: { slug, isPublic: true }, include: { services: { where: { active: true } } } });
  if (!pro) notFound();
  const cfg = await professionalConfig(pro);
  const user = await getUser();
  const service = pro.services.find((s) => s.id === servico);
  const slots = service ? await availableSlots(pro.id, service.id, 21) : [];
  const chosen = horario && slots.find((s) => s.toISOString() === horario) ? new Date(horario) : null;
  const step = !service ? 1 : !chosen ? 2 : 3;
  const tz = pro.timezone;
  const self = `/p/${slug}/agendar`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href={`/p/${slug}`} className="text-sm font-semibold text-primary">← {pro.displayName}</Link>
      <h1 className="mt-3 text-3xl font-semibold">Agendar com {pro.displayName.split(" ")[0]}</h1>
      <ol className="mt-4 flex gap-2 text-xs font-semibold" aria-label="Etapas">
        {["Serviço", "Horário", "Seus dados"].map((l, i) => (
          <li key={l} className={`flex-1 rounded-full py-1.5 text-center ${i + 1 <= step ? "bg-primary text-on-primary" : "bg-surface text-muted"}`} aria-current={i + 1 === step ? "step" : undefined}>{i + 1}. {l}</li>
        ))}
      </ol>
      {erro && <div className="mt-5"><Alert tone="danger">{erro}{erro.includes("Entre") && <> <Link className="font-semibold underline" href={`/entrar?next=${encodeURIComponent(`${self}?servico=${servico}&horario=${horario ?? ""}`)}`}>Entrar</Link></>}</Alert></div>}

      {step === 1 && (
        <div className="mt-6 space-y-3">
          {pro.services.map((s) => (
            <Link key={s.id} href={`${self}?servico=${s.id}`} className="flex items-center justify-between rounded-2xl border border-line bg-card p-4 shadow-soft hover:border-primary">
              <span><span className="block font-semibold">{s.name}</span><span className="text-sm text-muted">{s.durationMin} min · {modalityLabel[s.modality]}</span></span>
              <span className="font-semibold">{money(s.priceCents)}</span>
            </Link>
          ))}
        </div>
      )}

      {step === 2 && (
        <Card className="mt-6">
          <p className="mb-4 text-sm text-muted">{service!.name} · {service!.durationMin} min · <Link href={self} className="font-semibold text-primary">trocar</Link></p>
          <form action={self} className="space-y-5">
            <input type="hidden" name="servico" value={service!.id} />
            <SlotPicker slots={slots} tz={tz} name="horario" />
            <SubmitButton className="w-full" pendingText="Carregando…">Continuar</SubmitButton>
          </form>
        </Card>
      )}

      {step === 3 && (
        <form action={bookPublic} className="mt-6 space-y-5">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="serviceId" value={service!.id} />
          <input type="hidden" name="start" value={chosen!.toISOString()} />
          <Card className="bg-surface">
            <p className="font-semibold">{service!.name}</p>
            <p className="text-sm capitalize">{dateLong(chosen!, tz)}, às {time(chosen!, tz)}</p>
            <p className="text-sm text-muted">{modalityLabel[service!.modality]} · {money(service!.priceCents)} · <Link href={`${self}?servico=${service!.id}`} className="font-semibold text-primary">trocar horário</Link></p>
          </Card>

          <Card className="space-y-4">
            {user ? (
              <p className="text-sm">Agendando como <strong>{user.name}</strong> ({user.email}).</p>
            ) : (
              <>
                <h2 className="text-lg font-semibold">Seus dados</h2>
                <p className="-mt-2 text-sm text-muted">Com eles você confirma, remarca ou cancela pelo seu portal. Já tem conta? <Link className="font-semibold text-primary" href={`/entrar?next=${encodeURIComponent(`${self}?servico=${service!.id}&horario=${chosen!.toISOString()}`)}`}>Entrar</Link></p>
                <Field label="Nome completo" htmlFor="name"><Input id="name" name="name" autoComplete="name" required /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="E-mail" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
                  <Field label="Celular / WhatsApp" htmlFor="phone"><Input id="phone" name="phone" type="tel" autoComplete="tel" required /></Field>
                </div>
                <Field label="Crie uma senha" htmlFor="password" hint="Pelo menos 8 caracteres."><Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required /></Field>
              </>
            )}
          </Card>

          {cfg.intakeForm && (
            <Card>
              <p className="mb-4 text-sm text-muted">{cfg.intakeForm.name}. Só {pro.displayName.split(" ")[0]} terá acesso às respostas.</p>
              <DynamicFields template={cfg.intakeForm} prefix="i_" />
            </Card>
          )}

          <label className="flex items-start gap-3 rounded-2xl border border-line bg-card p-4 text-sm">
            <input type="checkbox" name="consent" required className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" />
            <span>
              Autorizo o tratamento dos meus dados por {pro.displayName} e pela DRAP Concord para este atendimento, conforme a{" "}
              <Link href="/privacidade" className="font-semibold text-primary underline">política de privacidade</Link> (LGPD).
              <span className="mt-1 block text-muted">{cfg.compliance.consents.join(" · ")}</span>
            </span>
          </label>
          <SubmitButton className="w-full" pendingText="Agendando…">Confirmar agendamento</SubmitButton>
        </form>
      )}
    </div>
  );
}
