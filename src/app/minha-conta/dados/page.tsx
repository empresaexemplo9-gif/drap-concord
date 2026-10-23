import { Alert, Card, Field, Input, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmt } from "@/lib/format";
import { deleteAccount } from "../actions";

export const metadata = { title: "Meus dados" };

export default async function Dados({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const user = await requireUser(["CLIENT"]);
  const { erro } = await searchParams;
  const consents = await db.consent.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader title="Meus dados e privacidade" subtitle="Seus direitos pela LGPD, sem burocracia." />
      <div className="space-y-6">
        <Card className="space-y-1 text-sm">
          <p><span className="text-muted">Nome:</span> {user.name}</p>
          <p><span className="text-muted">E-mail:</span> {user.email}</p>
          {user.phone && <p><span className="text-muted">Telefone:</span> {user.phone}</p>}
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Baixar meus dados</h2>
          <p className="mt-1 text-sm text-muted">Arquivo com seu cadastro, agendamentos, consentimentos e notificações.</p>
          <a href="/api/meus-dados" className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-line bg-card px-4 text-sm font-semibold hover:bg-surface">Baixar (JSON)</a>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Consentimentos registrados</h2>
          {consents.length === 0 ? <p className="mt-1 text-sm text-muted">Nenhum.</p> : (
            <ul className="mt-2 space-y-1 text-sm">{consents.map((c) => <li key={c.id}>{c.purpose} <span className="text-muted">· {fmt(c.createdAt, "dd/MM/yyyy")}</span></li>)}</ul>
          )}
        </Card>
        <Card className="border-danger/30">
          <h2 className="text-lg font-semibold">Excluir minha conta</h2>
          <p className="mt-1 text-sm text-muted">Seu acesso e dados de cadastro são apagados. Registros que o profissional é obrigado por lei a guardar ficam com ele, sem vínculo com a sua conta.</p>
          <form action={deleteAccount} className="mt-4 space-y-3">
            {erro && <Alert tone="danger">{erro}</Alert>}
            <Field label="Digite EXCLUIR para confirmar" htmlFor="confirm"><Input id="confirm" name="confirm" autoComplete="off" className="max-w-48" /></Field>
            <SubmitButton variant="danger" pendingText="Excluindo…">Excluir conta</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
