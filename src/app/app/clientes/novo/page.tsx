import { Alert, Card, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { requireProfessional } from "@/lib/auth";
import { professionalConfig } from "@/lib/profiles/registry";
import { createClient } from "../../actions";

export const metadata = { title: "Novo cadastro" };

export default async function NovoCliente({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { professional } = await requireProfessional();
  const { erro } = await searchParams;
  const cfg = await professionalConfig(professional);
  return (
    <>
      <PageHeader title={`Novo(a) ${cfg.terminology.client.singular}`} />
      <Card>
        <form action={createClient} className="grid gap-4 lg:grid-cols-2">
          {erro && <Alert tone="danger">{erro}</Alert>}
          <div className="lg:col-span-2"><Field label="Nome completo" htmlFor="name"><Input id="name" name="name" required /></Field></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="E-mail" htmlFor="email"><Input id="email" name="email" type="email" /></Field>
            <Field label="Telefone" htmlFor="phone"><Input id="phone" name="phone" type="tel" /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data de nascimento" htmlFor="birthDate"><Input id="birthDate" name="birthDate" type="date" /></Field>
            <Field label="Responsável (se menor)" htmlFor="guardianName"><Input id="guardianName" name="guardianName" /></Field>
          </div>
          <Field label="Tags" htmlFor="tags" hint="Separe por vírgula. Ex.: semanal, convênio"><Input id="tags" name="tags" /></Field>
          <Field label="Notas privadas" htmlFor="notes"><Textarea id="notes" name="notes" /></Field>
          <div className="lg:col-span-2"><SubmitButton>Salvar</SubmitButton></div>
        </form>
      </Card>
    </>
  );
}
