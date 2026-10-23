import { Alert, Badge, Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { requireProfessional } from "@/lib/auth";
import { tenant } from "@/lib/tenant";
import { modalityLabel, money } from "@/lib/format";
import { saveService } from "../actions";

export const metadata = { title: "Serviços" };

function ServiceForm({ s }: { s?: { id: string; name: string; durationMin: number; priceCents: number; modality: string; active: boolean } }) {
  return (
    <form action={saveService} className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1.3fr_auto] sm:items-end">
      {s && <input type="hidden" name="id" value={s.id} />}
      <Field label="Nome" htmlFor={`name-${s?.id ?? "new"}`}><Input id={`name-${s?.id ?? "new"}`} name="name" defaultValue={s?.name} required /></Field>
      <Field label="Duração (min)" htmlFor={`d-${s?.id ?? "new"}`}><Input id={`d-${s?.id ?? "new"}`} name="durationMin" type="number" min={5} step={5} defaultValue={s?.durationMin ?? 50} required /></Field>
      <Field label="Preço (R$)" htmlFor={`p-${s?.id ?? "new"}`}><Input id={`p-${s?.id ?? "new"}`} name="price" inputMode="decimal" defaultValue={s ? (s.priceCents / 100).toFixed(2).replace(".", ",") : ""} /></Field>
      <Field label="Modalidade" htmlFor={`m-${s?.id ?? "new"}`}>
        <Select id={`m-${s?.id ?? "new"}`} name="modality" defaultValue={s?.modality ?? "IN_PERSON"}>
          {Object.entries(modalityLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Field>
      <div className="flex items-center gap-3">
        {s && (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={s.active} className="size-5 accent-[var(--primary)]" /> Ativo
          </label>
        )}
        {!s && <input type="hidden" name="active" value="on" />}
        <SubmitButton variant={s ? "secondary" : "primary"}>{s ? "Salvar" : "Adicionar"}</SubmitButton>
      </div>
    </form>
  );
}

export default async function Servicos({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { professional, orgId } = await requireProfessional();
  const { erro } = await searchParams;
  const services = await tenant(orgId).services.list(professional.id);
  return (
    <>
      <PageHeader title="Serviços e preços" subtitle="O que aparece na sua página pública e no agendamento." />
      {erro && <div className="mb-4"><Alert tone="danger">{erro}</Alert></div>}
      <div className="space-y-3">
        {services.map((s) => (
          <Card key={s.id}>
            <div className="mb-3 flex items-center gap-2">
              <p className="font-semibold">{s.name}</p>
              <span className="text-sm text-muted">{money(s.priceCents)}</span>
              {!s.active && <Badge>Inativo</Badge>}
            </div>
            <ServiceForm s={s} />
          </Card>
        ))}
        <Card className="border-dashed">
          <p className="mb-3 font-semibold">Novo serviço</p>
          <ServiceForm />
        </Card>
      </div>
      <p className="mt-6 text-sm text-muted">Pacotes de sessões, mensalidades e cobrança online (PIX e cartão) chegam na fase de financeiro.</p>
    </>
  );
}
