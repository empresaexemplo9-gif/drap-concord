import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, Button, Card, Field, Input } from "@/components/ui";
import { db } from "@/lib/db";
import { fmt } from "@/lib/format";
import { profileConfigSchema } from "@/lib/profiles/schema";
import { publishProfile, saveProfileDraft, sendProfileToReview, unpublishProfile } from "../../actions";

export const metadata = { title: "Editar perfil" };

const okMsg: Record<string, string> = {
  salvo: "Alterações salvas.",
  revisao: "Enviado para validação por especialista.",
  publicado: "Publicado! Já aparece no cadastro e na vitrine.",
  despublicado: "Perfil retirado do cadastro e da vitrine.",
};
const statusLabel = { DRAFT: "Rascunho", REVIEW: "Em validação", PUBLISHED: "Publicado" };

export default async function EditarPerfil({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { id } = await params;
  const { ok, erro } = await searchParams;
  const p = await db.professionProfile.findUnique({ where: { id }, include: { versions: { orderBy: { version: "desc" } } } });
  if (!p) notFound();

  return (
    <>
      <Link href="/admin/perfis" className="text-sm font-semibold text-primary">← Perfis</Link>
      <div className="mb-6 mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold">{p.name}</h1>
        <Badge tone={p.status === "PUBLISHED" ? "success" : p.status === "REVIEW" ? "warning" : "neutral"}>{statusLabel[p.status]}</Badge>
        <span className="text-sm text-muted">chave <code>{p.key}</code> · versão publicada {p.version}</span>
      </div>
      {ok && okMsg[ok] && <div className="mb-4"><Alert tone="success">{okMsg[ok]}</Alert></div>}
      {erro && <div className="mb-4"><Alert tone="danger"><strong>Não foi possível salvar.</strong> {erro}</Alert></div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <Card>
          <form action={saveProfileDraft} className="space-y-4">
            <input type="hidden" name="id" value={p.id} />
            <Field label="Nome da profissão" htmlFor="name"><Input id="name" name="name" defaultValue={p.name} /></Field>
            <Field label="Configuração (JSON)" htmlFor="config" hint="Validada pelo schema ao salvar: terminologia, campos, serviços, ficha, documentos, compliance e regras.">
              <textarea id="config" name="config" defaultValue={JSON.stringify(p.config, null, 2)} spellCheck={false} className="h-[60vh] w-full rounded-xl border border-line bg-card p-3 font-mono text-xs leading-relaxed text-ink focus:border-primary focus:outline-none" />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary">Salvar rascunho</Button>
              <Button formAction={sendProfileToReview} variant="secondary">Enviar para validação</Button>
              <Button formAction={publishProfile}>Publicar nova versão</Button>
            </div>
          </form>
        </Card>
        <div className="space-y-4">
          <Card className="text-sm">
            <h2 className="mb-2 font-semibold">Como funciona</h2>
            <ul className="list-disc space-y-1 pl-4 text-muted">
              <li>Publicar cria uma versão nova; profissionais já cadastrados continuam na versão que adotaram.</li>
              <li>Regras sensíveis (cancelar, bloquear) precisam começar em <code>SUGGEST</code>.</li>
              <li>Mantenha <code>compliance.validation</code> como <code>PENDENTE_VALIDACAO</code> até um especialista revisar.</li>
            </ul>
          </Card>
          <Card className="text-sm">
            <h2 className="mb-2 font-semibold">Histórico de versões</h2>
            {p.versions.length === 0 ? <p className="text-muted">Nunca publicado.</p> : (
              <ul className="space-y-1">{p.versions.map((v) => <li key={v.id}>v{v.version} <span className="text-muted">· {fmt(v.createdAt, "dd/MM/yyyy HH:mm")}</span></li>)}</ul>
            )}
          </Card>
          {(() => {
            const parsed = profileConfigSchema.safeParse(p.config);
            const types = parsed.success ? parsed.data.careTypes : [];
            return (
              <Card className="text-sm">
                <h2 className="mb-2 font-semibold">Tipos de atendimento e triagens</h2>
                {types.length === 0 ? <p className="text-muted">Nenhum. Adicione em <code>careTypes</code>.</p> : (
                  <ul className="space-y-2">
                    {types.map((t) => (
                      <li key={t.key}>
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-muted">{t.triage.questions.length} perguntas · {t.triage.rules.length} regras · serviços: {t.services.join(", ")}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })()}
          {p.status === "PUBLISHED" && (
            <form action={unpublishProfile}><input type="hidden" name="id" value={p.id} /><Button variant="danger" className="w-full">Despublicar</Button></form>
          )}
        </div>
      </div>
    </>
  );
}
