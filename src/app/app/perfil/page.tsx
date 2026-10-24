import Link from "next/link";
import { Alert, Badge, Card, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { requireProfessional } from "@/lib/auth";
import { db } from "@/lib/db";
import { professionalConfig } from "@/lib/profiles/registry";
import { saveProfile } from "../actions";

export const metadata = { title: "Meu perfil" };

export default async function Perfil({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { professional } = await requireProfessional();
  const { ok, erro } = await searchParams;
  const cfg = await professionalConfig(professional);
  const profile = await db.professionProfile.findUniqueOrThrow({ where: { id: professional.profileId } });
  const t = cfg.terminology;

  return (
    <>
      <PageHeader title="Meu perfil" subtitle={`Perfil profissional: ${profile.name} (versão ${professional.profileVersion})`} action={<Link href={`/p/${professional.slug}`} className="font-semibold text-primary">Ver página pública →</Link>} />
      {ok && <div className="mb-4"><Alert tone="success">Perfil salvo.</Alert></div>}
      {erro && <div className="mb-4"><Alert tone="danger">{erro}</Alert></div>}
      <form action={saveProfile} className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold">Página pública</h2>
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="isPublic" defaultChecked={professional.isPublic} className="size-5 accent-[var(--primary)]" />
            Aparecer na vitrine e aceitar agendamentos online
          </label>
          <Field label="Nome de exibição" htmlFor="displayName"><Input id="displayName" name="displayName" defaultValue={professional.displayName} required /></Field>
          <Field label="Endereço da página" htmlFor="slug" hint="Letras, números e hífens."><Input id="slug" name="slug" defaultValue={professional.slug} /></Field>
          <Field label="Título" htmlFor="headline" hint="Ex.: Psicóloga clínica · TCC"><Input id="headline" name="headline" defaultValue={professional.headline ?? ""} /></Field>
          <Field label="Apresentação" htmlFor="bio"><Textarea id="bio" name="bio" defaultValue={professional.bio ?? ""} className="min-h-32" /></Field>
          <Field label="Especializações" htmlFor="specialties" hint="Separe por vírgula."><Input id="specialties" name="specialties" defaultValue={professional.specialties.join(", ")} /></Field>
          <Field label="Cidade" htmlFor="city"><Input id="city" name="city" defaultValue={professional.city ?? ""} /></Field>
          <Field label={`Registro profissional${cfg.registry ? ` (${cfg.registry.label})` : ""}`} htmlFor="registryNumber">
            <Input id="registryNumber" name="registryNumber" defaultValue={professional.registryNumber ?? ""} />
          </Field>
          {professional.registryVerified ? <Badge tone="success">Registro verificado</Badge> : <Badge tone="warning">Registro em verificação</Badge>}
        </Card>
        <div className="space-y-6">
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold">Como você chama as coisas</h2>
            <p className="text-sm text-muted">Personalize sem alterar o perfil-base da profissão.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cliente (singular)" htmlFor="clientSingular"><Input id="clientSingular" name="clientSingular" defaultValue={t.client.singular} /></Field>
              <Field label="Cliente (plural)" htmlFor="clientPlural"><Input id="clientPlural" name="clientPlural" defaultValue={t.client.plural} /></Field>
              <Field label="Atendimento (singular)" htmlFor="apptSingular"><Input id="apptSingular" name="apptSingular" defaultValue={t.appointment.singular} /></Field>
              <Field label="Atendimento (plural)" htmlFor="apptPlural"><Input id="apptPlural" name="apptPlural" defaultValue={t.appointment.plural} /></Field>
            </div>
            <Field label="Antecedência mínima para o cliente cancelar ou remarcar (horas)" htmlFor="minHours">
              <Input id="minHours" name="minHours" type="number" min={0} defaultValue={cfg.cancellationPolicy.minHoursBefore} className="max-w-32" />
            </Field>
          </Card>
          {cfg.careTypes.length > 0 && (
            <Card className="space-y-3 text-sm">
              <h2 className="text-lg font-semibold">Links de triagem</h2>
              <p className="text-muted">Envie para quem quer agendar (WhatsApp, Instagram): a pessoa responde a triagem do tipo de atendimento e já escolhe o horário.</p>
              <ul className="space-y-2">
                {cfg.careTypes.map((c) => (
                  <li key={c.key} className="rounded-xl bg-surface px-3 py-2">
                    <p className="font-medium">{c.name}</p>
                    <code className="block break-all text-xs text-muted">{`${process.env.APP_URL ?? ""}/p/${professional.slug}/agendar?tipo=${c.key}`}</code>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card className="space-y-2 text-sm">
            <h2 className="text-lg font-semibold">Compliance do perfil</h2>
            <Badge tone="warning">Pendente de validação por especialista</Badge>
            <p><span className="text-muted">Sigilo:</span> {cfg.compliance.confidentiality === "SIGILOSO" ? "Sigiloso" : "Normal"}</p>
            <p><span className="text-muted">Guarda dos registros:</span> {cfg.compliance.retentionYears} anos</p>
            <p><span className="text-muted">Consentimentos:</span> {cfg.compliance.consents.join("; ")}</p>
            {cfg.compliance.notes && <p className="text-muted">{cfg.compliance.notes}</p>}
          </Card>
          <SubmitButton className="w-full">Salvar perfil</SubmitButton>
        </div>
      </form>
    </>
  );
}
