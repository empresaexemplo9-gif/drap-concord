import Link from "next/link";
import { Alert, Button, Card, Field, Input, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { db } from "@/lib/db";
import { allThemes } from "@/lib/themes/load";
import { hex, themeTokens } from "@/lib/themes/colors";
import { createTheme, deleteTheme, updateTheme } from "../actions";

export const metadata = { title: "Temas das profissões" };

const okMsg: Record<string, string> = {
  criado: "Tema criado. As profissões marcadas já usam a nova imagem.",
  salvo: "Tema salvo.",
  excluido: "Tema excluído. As profissões que o usavam ficaram sem imagem.",
};

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className="size-5 rounded-md border border-line" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}

function ProfessionChecks({ profiles, selected, idPrefix }: { profiles: { id: string; name: string; themeName: string | null }[]; selected: Set<string>; idPrefix: string }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">Profissões que usam este tema</legend>
      <div className="flex flex-wrap gap-2">
        {profiles.map((p) => (
          <label key={p.id} htmlFor={`${idPrefix}-${p.id}`} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-line bg-card px-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-info-bg">
            <input id={`${idPrefix}-${p.id}`} type="checkbox" name="profiles" value={p.id} defaultChecked={selected.has(p.id)} className="size-4 accent-[var(--primary)]" />
            {p.name}
            {p.themeName && !selected.has(p.id) && <span className="text-xs text-muted">(hoje: {p.themeName})</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default async function Temas({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams;
  const [themes, profileRows, sample] = await Promise.all([
    allThemes(),
    db.professionProfile.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, theme: { select: { name: true } } } }),
    db.professional.findMany({ where: { isPublic: true }, select: { slug: true, profileId: true }, distinct: ["profileId"] }),
  ]);
  const profiles = profileRows.map((p) => ({ id: p.id, name: p.name, themeName: p.theme?.name ?? null }));
  const sampleByProfile = new Map(sample.map((s) => [s.profileId, s.slug]));

  return (
    <>
      <PageHeader
        title="Temas das profissões"
        subtitle="A imagem do tema cobre toda a área e a página pública dos profissionais da profissão. As cores da plataforma e o efeito de vidro são gerados a partir dela, com contraste garantido."
      />
      {ok && okMsg[ok] && <div className="mb-4"><Alert tone="success">{okMsg[ok]}</Alert></div>}
      {erro && <div className="mb-4"><Alert tone="danger">{erro}</Alert></div>}

      <Card className="mb-8">
        <h2 className="mb-1 text-lg font-semibold">Adicionar imagem</h2>
        <p className="mb-4 text-sm text-muted">JPG, PNG ou WebP, até 4 MB, com pelo menos 1000 px de largura (ideal: 1920 px ou mais, horizontal).</p>
        <form action={createTheme} className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <Field label="Nome do tema" htmlFor="new-name"><Input id="new-name" name="name" placeholder="Ex.: Consultório veterinário" required /></Field>
          <Field label="Imagem" htmlFor="new-file"><Input id="new-file" name="file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required className="py-2.5" /></Field>
          <div className="lg:col-span-2"><ProfessionChecks profiles={profiles} selected={new Set()} idPrefix="new" /></div>
          <div className="lg:col-span-2"><SubmitButton pendingText="Processando imagem…">Adicionar tema</SubmitButton></div>
        </form>
      </Card>

      <h2 className="mb-3 text-xl font-semibold">Temas ({themes.length})</h2>
      <div className="grid gap-5 xl:grid-cols-2">
        {themes.map((t) => {
          const tok = themeTokens(t.palette);
          const selected = new Set(t.profiles.map((p) => p.id));
          const example = t.profiles.map((p) => sampleByProfile.get(p.id)).find(Boolean);
          return (
            <Card key={t.id} className="overflow-hidden p-0">
              <div className="relative aspect-[16/7] bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element -- prévia servida pela API de temas */}
                <img src={t.url} alt={`Prévia do tema ${t.name}`} className="h-full w-full object-cover" loading="lazy" />
                <div className="absolute bottom-3 left-3 flex gap-2">
                  <span className="rounded-lg px-3 py-1.5 text-sm font-semibold" style={{ background: tok.light["--primary"], color: tok.light["--on-primary"] }}>Botão (claro)</span>
                  <span className="rounded-lg px-3 py-1.5 text-sm font-semibold" style={{ background: tok.dark["--primary"], color: tok.dark["--on-primary"] }}>Botão (escuro)</span>
                </div>
              </div>
              <form action={updateTheme} className="space-y-4 p-5">
                <input type="hidden" name="id" value={t.id} />
                <div className="flex flex-wrap gap-3">
                  <Swatch color={hex(t.palette.vibrant)} label="Cor marcante" />
                  <Swatch color={hex(t.palette.average)} label="Tom médio" />
                  <Swatch color={tok.light["--primary"]} label="Acento claro" />
                  <Swatch color={tok.dark["--primary"]} label="Acento escuro" />
                  <span className="text-xs text-muted">{t.width}×{t.height}px</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Nome" htmlFor={`name-${t.id}`}><Input id={`name-${t.id}`} name="name" defaultValue={t.name} /></Field>
                  <Field label="Trocar imagem (opcional)" htmlFor={`file-${t.id}`}><Input id={`file-${t.id}`} name="file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="py-2.5" /></Field>
                </div>
                <ProfessionChecks profiles={profiles} selected={selected} idPrefix={t.id} />
                <div className="flex flex-wrap items-center gap-2">
                  <SubmitButton variant="secondary" pendingText="Salvando…">Salvar</SubmitButton>
                  {example && <Link href={`/p/${example}`} className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-primary hover:bg-surface">Ver exemplo →</Link>}
                </div>
              </form>
              <form action={deleteTheme} className="border-t border-line px-5 py-3">
                <input type="hidden" name="id" value={t.id} />
                <Button variant="ghost" className="min-h-9 px-2 text-danger">Excluir tema</Button>
              </form>
            </Card>
          );
        })}
      </div>
    </>
  );
}
