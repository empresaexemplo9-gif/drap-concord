import Link from "next/link";
import { Alert, Badge, Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { BrandMark } from "@/components/brand-mark";
import { requireProfessional } from "@/lib/auth";
import { db } from "@/lib/db";
import { assetUrl, BACKGROUNDS, FONTS, parseBrand } from "@/lib/brand";
import { allThemes, themeForProfessional } from "@/lib/themes/load";
import { hex } from "@/lib/themes/colors";
import { resetBrand, saveIdentity, savePage, saveVisual } from "./actions";

export const metadata = { title: "Minha marca" };

const radioCard = "flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-surface";
const check = "flex min-h-11 items-center gap-2 text-sm font-medium";
const box = "size-5 accent-[var(--primary)]";

export default async function Marca({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { professional, memberRole } = await requireProfessional();
  const { ok, erro } = await searchParams;
  const brand = parseBrand(professional.brand);
  const [assets, library, current, profile] = await Promise.all([
    db.brandAsset.findMany({ where: { professionalId: professional.id }, select: { kind: true, updatedAt: true } }),
    allThemes(),
    themeForProfessional(professional),
    db.professionProfile.findUniqueOrThrow({ where: { id: professional.profileId }, select: { name: true, theme: { select: { name: true } } } }),
  ]);
  const logo = assets.find((a) => a.kind === "LOGO");
  const bg = assets.find((a) => a.kind === "BACKGROUND");
  const logoSrc = logo ? assetUrl(professional.id, "logo", logo.updatedAt) : null;
  const name = brand.businessName ?? professional.displayName;
  const color = brand.primaryColor ?? (current?.palette ? hex(current.palette.vibrant) : "#a35d33");
  const locked = memberRole !== "OWNER";
  const c = brand.contacts;

  return (
    <>
      <PageHeader
        title="Minha marca"
        subtitle="Sua página, seu jeito. Você começa com o visual da sua profissão e pode trocar tudo: nome da empresa, logo, imagem de fundo, cores, fonte e o que aparece para seus clientes. As mudanças valem na sua área, na sua página pública, nos convites e no portal dos seus clientes."
        action={<Link href={`/p/${professional.slug}`} className="font-semibold text-primary">Ver minha página →</Link>}
      />
      {ok && <div className="mb-4"><Alert tone="success">{ok}</Alert></div>}
      {erro && <div className="mb-4"><Alert tone="danger">{erro}</Alert></div>}
      {locked && <div className="mb-4"><Alert tone="info">Só o titular da conta pode alterar a marca.</Alert></div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <fieldset disabled={locked} className="min-w-0 space-y-6">
          <Card>
            <h2 className="text-lg font-semibold">Identidade</h2>
            <p className="mb-4 text-sm text-muted">Como sua empresa ou consultório aparece para os clientes.</p>
            <form action={saveIdentity} className="grid gap-4 lg:grid-cols-2">
              <Field label="Nome da marca ou empresa" htmlFor="businessName" hint={`Em branco, aparece seu nome: ${professional.displayName}.`}>
                <Input id="businessName" name="businessName" defaultValue={brand.businessName ?? ""} maxLength={80} />
              </Field>
              <Field label="Frase de apresentação" htmlFor="tagline" hint="Aparece sob o nome. Ex.: Cuidado emocional para adultos.">
                <Input id="tagline" name="tagline" defaultValue={brand.tagline ?? ""} maxLength={140} />
              </Field>
              <div className="flex items-center gap-4 lg:col-span-2">
                <BrandMark name={name} logoUrl={logoSrc} size={72} />
                <div className="flex-1 space-y-2">
                  <Field label="Logo" htmlFor="logo" hint="PNG com fundo transparente ou SVG ficam melhores. Até 2 MB.">
                    <Input id="logo" name="logo" type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="py-2" />
                  </Field>
                  {logo && <label className={check}><input type="checkbox" name="removeLogo" className={box} /> Remover logo atual</label>}
                </div>
              </div>
              <div className="lg:col-span-2"><SubmitButton>Salvar identidade</SubmitButton></div>
            </form>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Visual</h2>
            <p className="mb-4 text-sm text-muted">Imagem que cobre a página, cor principal, fonte dos títulos e efeito de vidro.</p>
            <form action={saveVisual} className="space-y-5">
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium">Fundo</legend>
                <div className="grid gap-2 md:grid-cols-2">
                  {Object.entries(BACKGROUNDS).map(([k, label]) => (
                    <label key={k} className={radioCard}>
                      <input type="radio" name="background" value={k} defaultChecked={brand.background === k} className="mt-0.5 size-5 accent-[var(--primary)]" />
                      <span>
                        <span className="block font-semibold">{label}</span>
                        <span className="text-muted">
                          {k === "profession" && (profile.theme ? `${profile.theme.name} (${profile.name})` : "A profissão ainda não tem imagem")}
                          {k === "library" && "Escolha abaixo qualquer imagem da plataforma"}
                          {k === "custom" && (bg ? "Imagem enviada por você" : "Envie abaixo uma foto do seu espaço ou da sua marca")}
                          {k === "none" && "Visual limpo, só com a sua cor"}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-sm font-medium">Galeria</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-4">
                  {library.map((t) => (
                    <label key={t.id} className="cursor-pointer overflow-hidden rounded-xl border-2 border-transparent has-[:checked]:border-primary">
                      <input type="radio" name="libraryThemeId" value={t.id} defaultChecked={brand.libraryThemeId === t.id} className="sr-only" />
                      {/* eslint-disable-next-line @next/next/no-img-element -- miniatura servida pela API de temas */}
                      <img src={t.url} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />
                      <span className="block truncate bg-card px-2 py-1 text-xs">{t.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  {bg && (
                    // eslint-disable-next-line @next/next/no-img-element -- imagem própria servida pela API da marca
                    <img src={assetUrl(professional.id, "fundo", bg.updatedAt)} alt="Sua imagem de fundo" className="aspect-[16/9] w-full rounded-xl object-cover" />
                  )}
                  <Field label={bg ? "Trocar minha imagem de fundo" : "Minha imagem de fundo"} htmlFor="backgroundImage" hint="Horizontal, a partir de 1000 px de largura. Até 4 MB. Ao enviar, ela passa a ser usada.">
                    <Input id="backgroundImage" name="backgroundImage" type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="py-2" />
                  </Field>
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-medium">Cor principal</p>
                  <label className={check}><input type="radio" name="colorMode" value="auto" defaultChecked={!brand.primaryColor} className={box} /> Tirar da imagem de fundo</label>
                  <label className={check}><input type="radio" name="colorMode" value="custom" defaultChecked={!!brand.primaryColor} className={box} /> Usar a cor da minha marca</label>
                  <input type="color" name="primaryColor" defaultValue={color} aria-label="Cor da marca" className="h-11 w-24 cursor-pointer rounded-xl border border-line bg-card p-1" />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Field label="Fonte dos títulos" htmlFor="font">
                  <Select id="font" name="font" defaultValue={brand.font}>
                    {Object.entries(FONTS).map(([k, f]) => <option key={k} value={k}>{f.label} · {f.sample}</option>)}
                  </Select>
                </Field>
                <label className={`${check} self-end`}><input type="checkbox" name="glass" defaultChecked={brand.glass} className={box} /> Efeito de vidro (cartões translúcidos sobre a imagem)</label>
              </div>
              <SubmitButton>Salvar visual</SubmitButton>
            </form>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Página pública</h2>
            <p className="mb-4 text-sm text-muted">Contatos e o que seus clientes veem. Seu nome, apresentação e especializações ficam em <Link href="/app/perfil" className="font-semibold text-primary">Meu perfil</Link>.</p>
            <form action={savePage} className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <Field label="WhatsApp" htmlFor="whatsapp"><Input id="whatsapp" name="whatsapp" type="tel" defaultValue={c.whatsapp ?? ""} placeholder="(11) 99999-9999" /></Field>
                <Field label="Instagram" htmlFor="instagram"><Input id="instagram" name="instagram" defaultValue={c.instagram ?? ""} placeholder="@suamarca" /></Field>
                <Field label="Site" htmlFor="website"><Input id="website" name="website" defaultValue={c.website ?? ""} placeholder="suamarca.com.br" /></Field>
                <Field label="E-mail de contato" htmlFor="email"><Input id="email" name="email" type="email" defaultValue={c.email ?? ""} /></Field>
                <p className="text-sm text-muted lg:col-span-2">O endereço e o mapa ficam em <Link href="/app/atendimento" className="font-semibold text-primary">Como atendo</Link>.</p>
                <Field label="Texto do botão de agendar" htmlFor="ctaLabel" hint="Ex.: Marcar consulta, Reservar aula, Agendar horário."><Input id="ctaLabel" name="ctaLabel" defaultValue={brand.ctaLabel ?? ""} placeholder="Agendar" maxLength={30} /></Field>
              </div>
              <fieldset>
                <legend className="mb-1 text-sm font-medium">Mostrar na página</legend>
                <div className="grid gap-x-6 sm:grid-cols-2">
                  <label className={check}><input type="checkbox" name="prices" defaultChecked={brand.sections.prices} className={box} /> Preços dos serviços</label>
                  <label className={check}><input type="checkbox" name="nextSlots" defaultChecked={brand.sections.nextSlots} className={box} /> Próximos horários livres</label>
                  <label className={check}><input type="checkbox" name="specialties" defaultChecked={brand.sections.specialties} className={box} /> Especializações</label>
                  <label className={check}><input type="checkbox" name="reviews" defaultChecked={brand.sections.reviews} className={box} /> Avaliações de clientes</label>
                </div>
              </fieldset>
              <SubmitButton>Salvar página</SubmitButton>
            </form>
          </Card>
        </fieldset>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:h-fit">
          <Card className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Prévia</p>
            <div className="flex items-center gap-3">
              <BrandMark name={name} logoUrl={logoSrc} size={56} />
              <div className="min-w-0">
                <p className="truncate text-xl font-semibold" style={{ fontFamily: "var(--heading-font)" }}>{name}</p>
                <p className="truncate text-sm text-muted">{brand.tagline ?? professional.headline ?? profile.name}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary">{brand.ctaLabel ?? "Agendar"}</span>
              <Badge tone="info">{BACKGROUNDS[brand.background]}</Badge>
            </div>
            <p className="text-sm text-muted">Esta área já está com o seu visual: o que você vê aqui é o que seus clientes veem.</p>
            <Link href={`/p/${professional.slug}`} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-line font-semibold text-primary hover:bg-surface">Abrir minha página</Link>
            {!locked && (
              <form action={resetBrand} className="border-t border-line pt-3">
                <button className="min-h-11 text-sm font-semibold text-danger">Voltar ao visual padrão da profissão</button>
              </form>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
