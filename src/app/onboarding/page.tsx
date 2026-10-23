import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Brand, Card, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { publishedProfiles } from "@/lib/profiles/registry";
import { modalityLabel, money } from "@/lib/format";
import { finishOnboarding } from "./actions";

export const metadata = { title: "Bem-vindo" };

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ perfil?: string }> }) {
  const user = await requireUser(["PROFESSIONAL", "PLATFORM_ADMIN"], "/entrar?next=/onboarding");
  if (user.professional) redirect("/app");
  const { perfil } = await searchParams;
  const profiles = await publishedProfiles();
  const chosen = profiles.find((p) => p.key === perfil);

  return (
    <div className="min-h-dvh">
      <header className="px-4 py-5 sm:px-8"><Brand /></header>
      <main className="mx-auto max-w-4xl px-4 pb-20">
        <ol className="mb-8 flex gap-2 text-xs font-semibold text-muted" aria-label="Etapas">
          <li className={!chosen ? "text-primary" : ""}>1. Sua profissão</li>
          <li aria-hidden>→</li>
          <li className={chosen ? "text-primary" : ""}>2. Revise e pronto</li>
        </ol>

        {!chosen ? (
          <>
            <h1 className="text-3xl font-semibold">Olá, {user.name.split(" ")[0]}! Qual é a sua área?</h1>
            <p className="mt-2 text-muted">A plataforma se adapta: nomes, serviços, ficha de atendimento, documentos e regras.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {profiles.map((p) => (
                <Link key={p.key} href={`/onboarding?perfil=${p.key}`} className="group rounded-2xl border border-line bg-card p-5 shadow-soft transition-colors hover:border-primary">
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent">{p.config.category}</p>
                  <p className="mt-1 font-serif text-lg font-semibold group-hover:text-primary">{p.name}</p>
                  <p className="mt-1 text-sm text-muted">{p.config.description}</p>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
            <div>
              <Link href="/onboarding" className="text-sm font-semibold text-primary">← Trocar profissão</Link>
              <h1 className="mt-3 text-3xl font-semibold">{chosen.name}</h1>
              <p className="mt-2 text-muted">Isto já vem pronto para você. Tudo pode ser ajustado depois.</p>
              <Card className="mt-5 space-y-4">
                <div>
                  <p className="text-sm font-semibold">Seus {chosen.config.terminology.client.plural} terão {chosen.config.terminology.appointment.plural}:</p>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {chosen.config.services.map((s) => (
                      <li key={s.name} className="flex justify-between gap-3">
                        <span>{s.name} <span className="text-muted">· {s.durationMin} min · {modalityLabel[s.modality]}</span></span>
                        <span className="font-medium">{money(s.priceCents)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-semibold">Registro de atendimento</p>
                  <p className="text-sm text-muted">{chosen.config.terminology.record}: {chosen.config.recordTemplate.sections.flatMap((s) => s.fields).map((f) => f.label).join(", ")}</p>
                </div>
                {chosen.config.rules.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold">Regras automáticas</p>
                    <ul className="mt-1 list-disc pl-5 text-sm text-muted">
                      {chosen.config.rules.map((r) => <li key={r.key}>{r.name}{r.mode === "SUGGEST" && " (pede sua confirmação)"}</li>)}
                    </ul>
                  </div>
                )}
                <Badge tone="warning">Regras legais e éticas: pendentes de validação por especialista</Badge>
              </Card>
            </div>
            <Card className="h-fit p-6">
              <form action={finishOnboarding} className="space-y-4">
                <input type="hidden" name="profile" value={chosen.key} />
                <Field label="Nome de exibição" htmlFor="displayName" hint="Como aparece para seus clientes na vitrine.">
                  <Input id="displayName" name="displayName" defaultValue={user.name} required />
                </Field>
                <Field label="Cidade" htmlFor="city">
                  <Input id="city" name="city" placeholder="Ex.: São Paulo" />
                </Field>
                {chosen.config.registry && (
                  <Field label={`Registro (${chosen.config.registry.label})`} htmlFor="registry" hint="Verificamos manualmente para exibir o selo de registro verificado.">
                    <Input id="registry" name="registry" required={chosen.config.registry.required} />
                  </Field>
                )}
                <p className="text-sm text-muted">Horário inicial: segunda a sexta, 9h às 18h. Você ajusta em seguida.</p>
                <SubmitButton className="w-full" pendingText="Preparando sua agenda…">Pronto, criar minha agenda</SubmitButton>
              </form>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
