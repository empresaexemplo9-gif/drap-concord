import Link from "next/link";
import { Alert, Badge, Button, Card, Input, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { db } from "@/lib/db";
import { createProfile, duplicateProfile } from "../actions";

export const metadata = { title: "Perfis profissionais" };

const statusInfo = {
  DRAFT: { label: "Rascunho", tone: "neutral" },
  REVIEW: { label: "Em validação", tone: "warning" },
  PUBLISHED: { label: "Publicado", tone: "success" },
} as const;

export default async function Perfis({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const profiles = await db.professionProfile.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { professionals: true } } } });
  return (
    <>
      <PageHeader title="Perfis profissionais" subtitle="Cada profissão é configuração. Publicar um perfil o coloca no cadastro, na vitrine e nos filtros, sem deploy." />
      {erro && <div className="mb-4"><Alert tone="danger">{erro}</Alert></div>}
      <Card className="mb-6">
        <form action={createProfile} className="flex flex-wrap items-end gap-3">
          <label className="min-w-64 flex-1 text-sm font-medium">Nova profissão<Input name="name" placeholder="Ex.: Veterinário(a)" className="mt-1.5" required /></label>
          <SubmitButton>Criar perfil</SubmitButton>
        </form>
      </Card>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {profiles.map((p) => {
          const s = statusInfo[p.status];
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Link href={`/admin/perfis/${p.id}`} className="min-w-0 flex-1">
                <span className="font-semibold hover:text-primary">{p.name}</span>
                <span className="block text-xs text-muted">{p.key} · versão {p.version} · {p._count.professionals} profissionais</span>
              </Link>
              <Badge tone={s.tone}>{s.label}</Badge>
              <form action={duplicateProfile}><input type="hidden" name="id" value={p.id} /><Button variant="ghost" className="min-h-9 px-3">Duplicar</Button></form>
            </li>
          );
        })}
      </ul>
    </>
  );
}
