import Link from "next/link";
import { BrandMark } from "./brand-mark";
import { assetUrl, parseBrand } from "@/lib/brand";
import { Badge, Card, EmptyState, Input, Select, Stars } from "@/components/ui";
import { categories } from "@/lib/profiles/registry";
import { searchProfessionals, type SearchParams } from "@/lib/search";
import { fmt, modalityLabel, money } from "@/lib/format";
import { ProfessionTheme } from "./profession-theme";
import { HomeVisual, Scene } from "./home-scenes";
import { getUser } from "@/lib/auth";
import { themeForUser } from "@/lib/themes/load";

/** Vitrine pública (busca + profissionais). `basePath` mantém os filtros na mesma rota. */
export async function Showcase({ sp, basePath }: { sp: SearchParams; basePath: string }) {
  const [cats, results, theme] = await Promise.all([categories(), searchProfessionals(sp), getUser().then(themeForUser)]);
  // Quem tem marca (profissional ou cliente de um profissional) vê o visual dela; os demais, a home da plataforma.
  const home = !theme;
  const filterKeys = ["q", "cidade", "categoria", "modalidade", "precoMax", "disponivel"] as const;
  const filtering = filterKeys.some((k) => sp[k]);

  return (
    <>
      {home ? <HomeVisual /> : <ProfessionTheme theme={theme} />}
      <Scene className={home ? "" : "bg-surface/70"}>
        <div className="gutter pb-10 pt-12 sm:pt-16">
          <div className="grid items-end gap-8 lg:grid-cols-[1.5fr_1fr]">
            <div className={home ? "rounded-3xl border border-line bg-card/70 p-6 shadow-soft sm:p-8" : ""}>
              <p className="text-sm font-semibold text-accent">Saúde, jurídico, esporte, educação e muito mais</p>
              <h1 className="mt-2 text-4xl font-semibold leading-tight sm:text-5xl xl:text-6xl">Encontre quem cuida de você e agende em poucos toques</h1>
              <p className="mt-3 text-lg text-muted">Profissionais com registro verificado, horários reais e confirmação na hora.</p>
            </div>
            <ol className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {[
                ["1", "Busque", "por serviço, cidade ou modalidade"],
                ["2", "Escolha o horário", "só aparecem horários livres de verdade"],
                ["3", "Pronto", "confirme, remarque ou cancele pelo app"],
              ].map(([n, t, d]) => (
                <li key={n} className="flex items-center gap-3 rounded-2xl border border-line bg-card/70 p-3">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-serif font-semibold text-on-primary">{n}</span>
                  <span className="text-sm"><strong className="block text-ink">{t}</strong><span className="text-muted">{d}</span></span>
                </li>
              ))}
            </ol>
          </div>
          <form className="mt-8 grid gap-2 rounded-2xl border border-line bg-card p-3 shadow-soft sm:grid-cols-[2fr_1.2fr_1.2fr_auto]" role="search" aria-label="Buscar profissionais" action={basePath}>
            <Input name="q" defaultValue={sp.q} placeholder="Serviço, especialidade ou nome" aria-label="O que você procura" />
            <Input name="cidade" defaultValue={sp.cidade} placeholder="Cidade" aria-label="Cidade" />
            <Select name="modalidade" defaultValue={sp.modalidade ?? ""} aria-label="Modalidade">
              <option value="">Qualquer modalidade</option>
              {Object.entries(modalityLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <button className="min-h-11 rounded-xl bg-primary px-6 font-semibold text-on-primary hover:bg-primary-hover">Buscar</button>
            <details className="sm:col-span-4">
              <summary className="cursor-pointer px-1 text-sm font-medium text-primary">Mais filtros</summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <Select name="categoria" defaultValue={sp.categoria ?? ""} aria-label="Categoria">
                  <option value="">Todas as categorias</option>
                  {cats.map((c) => <option key={c}>{c}</option>)}
                </Select>
                <Input name="precoMax" type="number" min={0} defaultValue={sp.precoMax} placeholder="Preço máximo (R$)" aria-label="Preço máximo" />
                <label className="flex min-h-11 items-center gap-2 px-1 text-sm">
                  <input type="checkbox" name="disponivel" value="1" defaultChecked={!!sp.disponivel} className="size-5 accent-[var(--primary)]" /> Com horário nesta semana
                </label>
              </div>
            </details>
          </form>
          <div className="mt-5 flex flex-wrap gap-2">
            {cats.map((c) => (
              <Link key={c} href={`${basePath}?categoria=${encodeURIComponent(c)}`} className={`rounded-full border px-3.5 py-1.5 text-sm ${sp.categoria === c ? "border-primary bg-primary text-on-primary" : "border-line bg-card hover:border-primary"}`}>{c}</Link>
            ))}
          </div>
        </div>
      </Scene>

      <Scene image={home ? "profissoes" : undefined} className={`gutter py-10 ${home ? "min-h-[70vh] py-16" : ""}`}>
        <div className={`mb-5 flex flex-wrap items-baseline justify-between gap-3 ${home ? "rounded-2xl border border-line bg-card/70 px-5 py-4" : ""}`}>
          <h2 className="text-2xl font-semibold">{filtering ? `${results.length} ${results.length === 1 ? "profissional encontrado" : "profissionais encontrados"}` : "Profissionais em destaque"}</h2>
          {filtering && <Link href={basePath} className="text-sm font-semibold text-primary">Limpar filtros</Link>}
        </div>
        {results.length === 0 ? (
          filtering ? (
            <EmptyState title="Ninguém por aqui ainda" text="Tente outra cidade, modalidade ou palavra. Novos profissionais entram todos os dias." />
          ) : (
            <EmptyState title="Os primeiros profissionais estão chegando" text="É profissional? Crie sua conta grátis e seja um dos primeiros a receber agendamentos por aqui." action={<Link href="/cadastro" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-on-primary">Sou profissional</Link>} />
          )
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {results.map(({ pro, next, rating, category }) => (
              <Card key={pro.id} className="flex flex-col gap-4">
                <div className="flex gap-4">
                  <BrandMark name={parseBrand(pro.brand).businessName ?? pro.displayName} logoUrl={pro.brandAssets[0] ? assetUrl(pro.id, "logo", pro.brandAssets[0].updatedAt) : null} size={64} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-accent">{category}</p>
                    <Link href={`/p/${pro.slug}`} className="font-serif text-xl font-semibold hover:text-primary">{parseBrand(pro.brand).businessName ?? pro.displayName}</Link>
                    {parseBrand(pro.brand).businessName && <p className="text-sm">{pro.displayName}</p>}
                    <p className="text-sm text-muted">{pro.headline ?? pro.profile.name}{pro.city && ` · ${pro.city}`}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {pro.registryVerified && <Badge tone="success">✓ Registro verificado</Badge>}
                      {rating && <span className="inline-flex items-center gap-1 text-sm"><Stars value={rating} /> <span className="text-muted">({pro.reviews.length})</span></span>}
                    </div>
                  </div>
                </div>
                {pro.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">{pro.specialties.slice(0, 4).map((s) => <Badge key={s}>{s}</Badge>)}</div>
                )}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-sm">
                  <span>
                    {pro.services[0] && <>A partir de <strong>{money(pro.services[0].priceCents)}</strong></>}
                    {next && <span className="block text-muted">Próximo horário: {fmt(next, "EEE, d/MM 'às' HH:mm", pro.timezone)}</span>}
                  </span>
                  <Link href={`/p/${pro.slug}`} className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 font-semibold text-on-primary hover:bg-primary-hover">Ver horários</Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Scene>

      <Scene image={home ? "rotina" : undefined} className={`gutter ${home ? "flex min-h-[60vh] items-center py-20" : "pb-16"}`}>
        <Card className="flex w-full flex-col items-start gap-4 bg-primary p-8 text-on-primary sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Você atende pessoas?</h2>
            <p className="mt-1 opacity-90">Agenda, lembretes, fichas e página própria, configurados para a sua profissão em minutos.</p>
          </div>
          <Link href="/cadastro" className="inline-flex min-h-11 items-center rounded-xl bg-on-primary px-5 font-semibold text-primary">Começar grátis</Link>
        </Card>
      </Scene>
    </>
  );
}
