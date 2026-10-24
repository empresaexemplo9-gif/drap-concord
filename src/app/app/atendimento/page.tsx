import Link from "next/link";
import { Alert, Card, Field, Input, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { requireProfessional } from "@/lib/auth";
import { professionalConfig } from "@/lib/profiles/registry";
import { bookingDefaults } from "@/lib/profiles/schema";
import { saveAttendance } from "./actions";

export const metadata = { title: "Como atendo" };

const radioCard = "flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-surface";
const box = "size-5 accent-[var(--primary)]";

export default async function ComoAtendo({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { professional, memberRole } = await requireProfessional();
  const { ok, erro } = await searchParams;
  const [cfg, base] = await Promise.all([professionalConfig(professional), professionalConfig({ ...professional, overrides: {} })]);
  const b = bookingDefaults(professional.overrides);
  const t = cfg.terminology;
  const locked = memberRole !== "OWNER";

  return (
    <>
      <PageHeader
        title="Como atendo"
        subtitle="Seu método, suas regras. Defina como os agendamentos chegam, com quanta antecedência, se há triagem e como você chama cada coisa. O padrão da profissão é só o ponto de partida."
      />
      {ok && <div className="mb-4"><Alert tone="success">Modo de atendimento salvo.</Alert></div>}
      {erro && <div className="mb-4"><Alert tone="danger">{erro}</Alert></div>}
      {locked && <div className="mb-4"><Alert tone="info">Só o titular da conta pode alterar o modo de atendimento.</Alert></div>}

      <form action={saveAttendance}>
        <fieldset disabled={locked} className="grid min-w-0 gap-6 xl:grid-cols-2">
          <div className="space-y-6">
            <Card className="space-y-4">
              <h2 className="text-lg font-semibold">Agendamentos online</h2>
              <fieldset className="grid gap-2 md:grid-cols-2">
                <legend className="mb-2 text-sm font-medium">Quando alguém agenda pela sua página</legend>
                <label className={radioCard}>
                  <input type="radio" name="confirmation" value="AUTO" defaultChecked={b.confirmation === "AUTO"} className="mt-0.5 size-5 accent-[var(--primary)]" />
                  <span><span className="block font-semibold">Confirmar na hora</span><span className="text-muted">O horário já fica confirmado.</span></span>
                </label>
                <label className={radioCard}>
                  <input type="radio" name="confirmation" value="MANUAL" defaultChecked={b.confirmation === "MANUAL"} className="mt-0.5 size-5 accent-[var(--primary)]" />
                  <span><span className="block font-semibold">Fica pendente</span><span className="text-muted">Você ou o cliente confirmam depois.</span></span>
                </label>
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Antecedência mínima para agendar (horas)" htmlFor="minNoticeHours" hint="0 = pode agendar para daqui a pouco.">
                  <Input id="minNoticeHours" name="minNoticeHours" type="number" min={0} max={720} defaultValue={b.minNoticeHours} />
                </Field>
                <Field label="Agenda aberta até (dias à frente)" htmlFor="maxAdvanceDays">
                  <Input id="maxAdvanceDays" name="maxAdvanceDays" type="number" min={1} max={365} defaultValue={b.maxAdvanceDays} />
                </Field>
                <Field label="Cancelar ou remarcar até (horas antes)" htmlFor="minHours">
                  <Input id="minHours" name="minHours" type="number" min={0} max={720} defaultValue={cfg.cancellationPolicy.minHoursBefore} />
                </Field>
                <Field label="Intervalo entre atendimentos (minutos)" htmlFor="bufferMin">
                  <Input id="bufferMin" name="bufferMin" type="number" min={0} max={240} defaultValue={professional.bufferMin} />
                </Field>
              </div>
            </Card>

            <Card className="space-y-3">
              <h2 className="text-lg font-semibold">Serviços, horários e regras</h2>
              <p className="text-sm text-muted">Crie seus próprios serviços (nome, duração, preço, presencial, online ou a domicílio), seus horários e as regras automáticas de faltas e lembretes.</p>
              <div className="flex flex-wrap gap-2">
                {[["/app/servicos", "Meus serviços"], ["/app/horarios", "Meus horários"], ["/app/regras", "Minhas regras"]].map(([href, label]) => (
                  <Link key={href} href={href} className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-semibold text-primary hover:bg-surface">{label}</Link>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            {base.careTypes.length > 0 && (
              <Card className="space-y-3">
                <h2 className="text-lg font-semibold">Triagem antes de agendar</h2>
                <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
                  <input type="checkbox" name="triage" defaultChecked={b.triage} className={box} /> Usar triagem na minha página
                </label>
                <p className="text-sm text-muted">Tipos de atendimento que você oferece:</p>
                <div className="grid gap-x-6 sm:grid-cols-2">
                  {base.careTypes.map((c) => (
                    <label key={c.key} className="flex min-h-11 items-center gap-2 text-sm">
                      <input type="hidden" name="careTypeKeys" value={c.key} />
                      <input type="checkbox" name="careTypes" value={c.key} defaultChecked={!b.careTypesOff.includes(c.key)} className={box} /> {c.name}
                    </label>
                  ))}
                </div>
              </Card>
            )}
            {base.careTypes.length === 0 && <input type="hidden" name="triage" value="on" />}

            <Card className="space-y-4">
              <h2 className="text-lg font-semibold">Como você chama as coisas</h2>
              <p className="text-sm text-muted">Paciente, aluno, cliente, consulta, aula, sessão: use as palavras do seu negócio. Elas aparecem na sua área e para seus clientes.</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cliente (singular)" htmlFor="clientSingular"><Input id="clientSingular" name="clientSingular" defaultValue={t.client.singular} /></Field>
                <Field label="Cliente (plural)" htmlFor="clientPlural"><Input id="clientPlural" name="clientPlural" defaultValue={t.client.plural} /></Field>
                <Field label="Atendimento (singular)" htmlFor="apptSingular"><Input id="apptSingular" name="apptSingular" defaultValue={t.appointment.singular} /></Field>
                <Field label="Atendimento (plural)" htmlFor="apptPlural"><Input id="apptPlural" name="apptPlural" defaultValue={t.appointment.plural} /></Field>
                <Field label="Registro do atendimento" htmlFor="record"><Input id="record" name="record" defaultValue={t.record} /></Field>
                <Field label="Seu título" htmlFor="professional"><Input id="professional" name="professional" defaultValue={t.professional} /></Field>
              </div>
            </Card>
            <SubmitButton className="w-full">Salvar modo de atendimento</SubmitButton>
          </div>
        </fieldset>
      </form>
    </>
  );
}
