import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Card, Field, Input } from "@/components/ui";
import { DynamicFields } from "@/components/dynamic-fields";
import { SlotPicker } from "@/components/slot-picker";
import { SubmitButton } from "@/components/submit-button";
import { TriageSummary } from "@/components/triage-summary";
import { db } from "@/lib/db";
import { getImpersonator, getUser } from "@/lib/auth";
import { availableSlots } from "@/lib/booking";
import { professionalConfig } from "@/lib/profiles/registry";
import { dateLong, modalityLabel, money, time } from "@/lib/format";
import { outcomeOf, resolveService } from "@/lib/triage/service";
import { bookPublic, submitTriage } from "./actions";

export const metadata = { title: "Agendar", robots: { index: false } };

type SP = { tipo?: string; triagem?: string; direto?: string; servico?: string; horario?: string; erro?: string };

export default async function AgendarPublico({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SP> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const admin = await getImpersonator();
  const pro = await db.professional.findFirst({ where: { slug, ...(admin ? {} : { isPublic: true }) }, include: { services: { where: { active: true }, orderBy: { createdAt: "asc" } } } });
  if (!pro) notFound();
  const cfg = await professionalConfig(pro);
  const user = await getUser();
  const tz = pro.timezone;
  const self = `/p/${slug}/agendar`;
  const first = pro.displayName.split(" ")[0];

  // Triagem já respondida (ainda não usada em um agendamento).
  const triage = sp.triagem ? await db.triageResponse.findFirst({ where: { id: sp.triagem, professionalId: pro.id, appointmentId: null } }) : null;
  const outcome = triage ? outcomeOf(triage) : null;
  const careType = cfg.careTypes.find((c) => c.key === (triage?.careTypeKey ?? sp.tipo));
  // Serviço escolhido direto (ex.: botão "Agendar" do serviço) pula a triagem.
  const withTriage = cfg.careTypes.length > 0 && !sp.direto && !(sp.servico && !triage);

  const service = sp.servico
    ? pro.services.find((s) => s.id === sp.servico)
    : outcome && !outcome.stop
      ? await resolveService(pro.id, outcome.service, careType?.services)
      : undefined;
  const slots = service ? await availableSlots(pro.id, service.id, 21, new Date(), { client: true }) : [];
  const chosen = sp.horario && slots.find((s) => s.toISOString() === sp.horario) ? new Date(sp.horario) : null;
  const modality = outcome?.modality ?? service?.modality;
  const keep = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    if (triage) q.set("triagem", triage.id);
    if (sp.direto) q.set("direto", "1");
    for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
    return `${self}?${q}`;
  };

  type Step = "procura" | "triagem" | "parar" | "horario" | "dados" | "servico";
  const step: Step = withTriage
    ? !careType ? "procura" : !triage ? "triagem" : outcome!.stop ? "parar" : !chosen ? "horario" : "dados"
    : !service ? "servico" : !chosen ? "horario" : "dados";
  const labels = withTriage ? ["O que você procura", "Triagem", "Horário", "Seus dados"] : ["Serviço", "Horário", "Seus dados"];
  const index = withTriage
    ? { procura: 0, triagem: 1, parar: 1, horario: 2, dados: 3, servico: 0 }[step]
    : { servico: 0, horario: 1, dados: 2, procura: 0, triagem: 0, parar: 0 }[step];
  const careServices = careType ? pro.services.filter((s) => careType.services.some((n) => n.toLowerCase() === s.name.toLowerCase())) : [];

  return (
    <div className="gutter grid gap-8 py-10 lg:grid-cols-[300px_1fr] xl:gap-12">
      <aside className="rounded-2xl border border-line bg-card/70 p-5 shadow-soft lg:sticky lg:top-6 lg:h-fit">
        <Link href={`/p/${slug}`} className="text-sm font-semibold text-primary">← {pro.displayName}</Link>
        <h1 className="mt-3 text-3xl font-semibold">Agendar com {first}</h1>
        <ol className="mt-4 flex gap-2 text-xs font-semibold lg:flex-col" aria-label="Etapas">
          {labels.map((l, i) => (
            <li key={l} className={`flex-1 rounded-full px-4 py-1.5 text-center lg:py-2.5 lg:text-left lg:text-sm ${i <= index ? "bg-primary text-on-primary" : "bg-surface text-muted"}`} aria-current={i === index ? "step" : undefined}>{i + 1}. {l}</li>
          ))}
        </ol>
        {(careType || service) && (
          <div className="mt-4 hidden rounded-2xl border border-line bg-card p-4 text-sm lg:block">
            {careType && <p className="text-xs font-semibold uppercase tracking-wide text-accent">{careType.name}</p>}
            {service && <p className="font-semibold">{service.name}</p>}
            {service && <p className="text-muted">{service.durationMin} min · {modalityLabel[modality!]} · {money(service.priceCents)}</p>}
            {chosen && <p className="mt-2 capitalize">{dateLong(chosen, tz)}, às {time(chosen, tz)}</p>}
          </div>
        )}
      </aside>

      <div className="min-w-0 space-y-5">
        {sp.erro && <Alert tone="danger">{sp.erro}{sp.erro.includes("Entre") && <> <Link className="font-semibold underline" href={`/entrar?next=${encodeURIComponent(keep({ servico: sp.servico, horario: sp.horario }))}`}>Entrar</Link></>}</Alert>}

        {step === "procura" && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-line bg-card/70 p-5 shadow-soft">
              <div>
                <h2 className="text-2xl font-semibold">O que você procura?</h2>
                <p className="text-muted">Escolha o tipo de atendimento. Em seguida, algumas perguntas rápidas preparam tudo para você.</p>
              </div>
              <Link href={`${self}?direto=1`} className="text-sm font-semibold text-primary">Já sei qual serviço quero →</Link>
            </div>
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {cfg.careTypes.map((c) => (
                <Link key={c.key} href={`${self}?tipo=${c.key}`} className="rounded-2xl border border-line bg-card p-5 shadow-soft hover:border-primary">
                  <p className="font-serif text-lg font-semibold">{c.name}</p>
                  <p className="mt-1 text-sm text-muted">{c.description}</p>
                </Link>
              ))}
            </div>
          </>
        )}

        {step === "triagem" && careType && (
          <Card>
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-2xl font-semibold">{careType.name}</h2>
              <Link href={self} className="text-sm font-semibold text-primary">trocar</Link>
            </div>
            <p className="mb-5 text-sm text-muted">{careType.triage.intro ?? `Suas respostas ajudam ${first} a preparar o atendimento certo para você. Só ${first} terá acesso a elas.`}</p>
            <form action={submitTriage} className="space-y-6">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="tipo" value={careType.key} />
              <DynamicFields template={{ name: careType.name, sections: [{ title: "Triagem", fields: careType.triage.questions }] }} prefix="t_" />
              <SubmitButton pendingText="Analisando…">Ver recomendação e horários</SubmitButton>
            </form>
          </Card>
        )}

        {step === "parar" && outcome && (
          <Card className="space-y-4">
            <h2 className="text-2xl font-semibold">Procure atendimento imediato</h2>
            <Alert tone="danger">{outcome.stop}</Alert>
            <p className="text-sm text-muted">Pelas suas respostas, esperar por um horário agendado não é seguro. Depois de atendido(a), você pode voltar e agendar o acompanhamento.</p>
            <Link href={self} className="inline-block text-sm font-semibold text-primary">← Voltar ao início</Link>
          </Card>
        )}

        {step === "horario" && service && (
          <>
            {outcome && careType && (
              <Card>
                <h2 className="mb-1 text-xl font-semibold">Recomendado para você</h2>
                <p className="mb-4 text-sm">
                  <strong>{service.name}</strong> · {service.durationMin} min · {modalityLabel[modality!]} · {money(service.priceCents)}
                </p>
                <TriageSummary outcome={outcome} careTypeName={careType.name} />
                {careServices.length > 1 && (
                  <div className="mt-4 flex flex-wrap gap-2 text-sm">
                    <span className="text-muted">Outras opções:</span>
                    {careServices.filter((s) => s.id !== service.id).map((s) => (
                      <Link key={s.id} href={keep({ servico: s.id })} className="rounded-full border border-line bg-card px-3 py-1 hover:border-primary">{s.name}</Link>
                    ))}
                  </div>
                )}
              </Card>
            )}
            <Card>
              <p className="mb-4 text-sm text-muted">{service.name} · {service.durationMin} min{!outcome && <> · <Link href={keep({})} className="font-semibold text-primary">trocar</Link></>}</p>
              <form action={self} className="space-y-5">
                {triage && <input type="hidden" name="triagem" value={triage.id} />}
                {sp.direto && <input type="hidden" name="direto" value="1" />}
                <input type="hidden" name="servico" value={service.id} />
                <SlotPicker slots={slots} tz={tz} name="horario" />
                <SubmitButton className="w-full" pendingText="Carregando…">Continuar</SubmitButton>
              </form>
            </Card>
          </>
        )}

        {step === "servico" && (
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {pro.services.map((s) => (
              <Link key={s.id} href={keep({ servico: s.id })} className="flex items-center justify-between rounded-2xl border border-line bg-card p-4 shadow-soft hover:border-primary">
                <span><span className="block font-semibold">{s.name}</span><span className="text-sm text-muted">{s.durationMin} min · {modalityLabel[s.modality]}</span></span>
                <span className="font-semibold">{money(s.priceCents)}</span>
              </Link>
            ))}
          </div>
        )}

        {step === "dados" && service && chosen && (
          <form action={bookPublic} className="grid gap-5 xl:grid-cols-2">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="serviceId" value={service.id} />
            <input type="hidden" name="start" value={chosen.toISOString()} />
            {triage && <input type="hidden" name="triagem" value={triage.id} />}
            <Card className="bg-surface xl:col-span-2">
              <p className="font-semibold">{service.name}</p>
              <p className="text-sm capitalize">{dateLong(chosen, tz)}, às {time(chosen, tz)}</p>
              <p className="text-sm text-muted">{modalityLabel[modality!]} · {money(service.priceCents)} · <Link href={keep({ servico: service.id })} className="font-semibold text-primary">trocar horário</Link></p>
            </Card>

            <Card className="space-y-4">
              {user ? (
                <p className="text-sm">Agendando como <strong>{user.name}</strong> ({user.email}).</p>
              ) : (
                <>
                  <h2 className="text-lg font-semibold">Seus dados</h2>
                  <p className="-mt-2 text-sm text-muted">Com eles você confirma, remarca ou cancela pelo seu portal. Já tem conta? <Link className="font-semibold text-primary" href={`/entrar?next=${encodeURIComponent(keep({ servico: service.id, horario: chosen.toISOString() }))}`}>Entrar</Link></p>
                  <Field label="Nome completo" htmlFor="name"><Input id="name" name="name" autoComplete="name" required /></Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="E-mail" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
                    <Field label="Celular / WhatsApp" htmlFor="phone"><Input id="phone" name="phone" type="tel" autoComplete="tel" required /></Field>
                  </div>
                  <Field label="Crie uma senha" htmlFor="password" hint="Pelo menos 8 caracteres."><Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required /></Field>
                </>
              )}
            </Card>

            {!triage && cfg.intakeForm && (
              <Card>
                <p className="mb-4 text-sm text-muted">{cfg.intakeForm.name}. Só {first} terá acesso às respostas.</p>
                <DynamicFields template={cfg.intakeForm} prefix="i_" />
              </Card>
            )}
            {triage && careType && outcome && (
              <Card>
                <p className="mb-3 text-sm font-semibold">Sua triagem vai junto com o agendamento</p>
                <TriageSummary outcome={outcome} careTypeName={careType.name} showAnswers />
              </Card>
            )}

            <label className="flex items-start gap-3 rounded-2xl border border-line bg-card p-4 text-sm xl:col-span-2">
              <input type="checkbox" name="consent" required className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" />
              <span>
                Autorizo o tratamento dos meus dados por {pro.displayName} e pela DRAP Concord para este atendimento, conforme a{" "}
                <Link href="/privacidade" className="font-semibold text-primary underline">política de privacidade</Link> (LGPD).
                <span className="mt-1 block text-muted">{cfg.compliance.consents.join(" · ")}</span>
              </span>
            </label>
            <div className="xl:col-span-2"><SubmitButton className="w-full sm:w-auto sm:px-10" pendingText="Agendando…">Confirmar agendamento</SubmitButton></div>
          </form>
        )}
      </div>
    </div>
  );
}
