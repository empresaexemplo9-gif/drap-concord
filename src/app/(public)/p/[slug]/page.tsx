import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Stars } from "@/components/ui";
import { BrandMark } from "@/components/brand-mark";
import { contactLinks, logoUrl, parseBrand } from "@/lib/brand";
import { db } from "@/lib/db";
import { getImpersonator } from "@/lib/auth";
import { availableSlots } from "@/lib/booking";
import { professionalConfig } from "@/lib/profiles/registry";
import { fmt, modalityLabel, money } from "@/lib/format";

async function load(slug: string) {
  // Profissionais de prévia (não públicos) só abrem para o admin no "Ver como".
  const admin = await getImpersonator();
  return db.professional.findFirst({
    where: { slug, ...(admin ? {} : { isPublic: true }) },
    include: {
      profile: true,
      services: { where: { active: true }, orderBy: { priceCents: "asc" } },
      reviews: { where: { status: "APPROVED" }, include: { client: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const pro = await load((await params).slug);
  if (!pro) return {};
  const name = parseBrand(pro.brand).businessName;
  const title = `${name ? `${name} · ` : ""}${pro.displayName}, ${pro.headline ?? pro.profile.name}${pro.city ? ` em ${pro.city}` : ""}`;
  const description = pro.bio?.slice(0, 155) ?? `Agende online com ${pro.displayName}.`;
  return { title, description, alternates: { canonical: `/p/${pro.slug}` }, openGraph: { title, description, type: "profile" } };
}

export default async function PerfilPublico({ params }: { params: Promise<{ slug: string }> }) {
  const pro = await load((await params).slug);
  if (!pro) notFound();
  const cfg = await professionalConfig(pro);
  const brand = parseBrand(pro.brand);
  const show = brand.sections;
  const cta = brand.ctaLabel ?? "Agendar";
  const contacts = contactLinks(brand.contacts);
  const name = brand.businessName ?? pro.displayName;
  const first = pro.services[0];
  const [slots, logo] = await Promise.all([
    first && show.nextSlots ? availableSlots(pro.id, first.id, 14, new Date(), { client: true }).then((s) => s.slice(0, 8)) : Promise.resolve([]),
    logoUrl(pro.id),
  ]);
  const rating = pro.reviews.length ? pro.reviews.reduce((s, r) => s + r.rating, 0) / pro.reviews.length : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name,
    description: pro.bio ?? undefined,
    address: pro.city || brand.contacts.address ? { "@type": "PostalAddress", streetAddress: brand.contacts.address, addressLocality: pro.city ?? undefined, addressCountry: "BR" } : undefined,
    aggregateRating: rating ? { "@type": "AggregateRating", ratingValue: rating.toFixed(1), reviewCount: pro.reviews.length } : undefined,
    makesOffer: pro.services.map((s) => ({ "@type": "Offer", name: s.name, ...(show.prices ? { price: (s.priceCents / 100).toFixed(2), priceCurrency: "BRL" } : {}) })),
  };

  return (
    <div className="gutter py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="grid gap-8 lg:grid-cols-[1fr_380px] 2xl:grid-cols-[1fr_440px] xl:gap-12">
        <div className="space-y-8 rounded-2xl border border-line bg-card/70 p-6 shadow-soft sm:p-8">
          <div className="flex gap-5">
            <BrandMark name={name} logoUrl={logo} size={96} />
            <div>
              <p className="text-sm font-semibold text-accent">{brand.businessName ? pro.displayName : cfg.category}</p>
              <h1 className="text-3xl font-semibold sm:text-4xl">{name}</h1>
              {brand.tagline && <p className="mt-1 text-lg">{brand.tagline}</p>}
              <p className="mt-1 text-muted">{pro.headline ?? pro.profile.name}{pro.city && ` · ${pro.city}`}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {pro.registryVerified && <Badge tone="success">✓ {cfg.registry?.label ?? "Registro"} verificado{pro.registryNumber && `: ${pro.registryNumber}`}</Badge>}
                {show.reviews && rating && <span className="inline-flex items-center gap-1 text-sm"><Stars value={rating} /> {rating.toFixed(1)} <span className="text-muted">({pro.reviews.length} avaliações)</span></span>}
              </div>
              {contacts.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2 text-sm" aria-label="Contatos">
                  {contacts.map((l) => (
                    <li key={l.href}><a href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center rounded-full border border-line bg-card px-3 font-medium text-primary hover:bg-surface">{l.label}</a></li>
                  ))}
                </ul>
              )}
              {brand.contacts.address && <p className="mt-2 text-sm text-muted">📍 {brand.contacts.address}</p>}
            </div>
          </div>

          {pro.bio && (
            <section>
              <h2 className="mb-2 text-xl font-semibold">Sobre</h2>
              <p className="whitespace-pre-line leading-relaxed text-ink">{pro.bio}</p>
              {show.specialties && pro.specialties.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{pro.specialties.map((s) => <Badge key={s}>{s}</Badge>)}</div>}
            </section>
          )}

          <section>
            <h2 className="mb-3 text-xl font-semibold">Serviços</h2>
            <div className="grid gap-3 xl:grid-cols-2">
              {pro.services.map((s) => (
                <Card key={s.id} className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-sm text-muted">{s.durationMin} min · {modalityLabel[s.modality]}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {show.prices && <span className="font-semibold">{money(s.priceCents)}</span>}
                    <Link href={`/p/${pro.slug}/agendar?servico=${s.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary-hover">{cta}</Link>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {show.reviews && pro.reviews.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-semibold">O que dizem</h2>
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {pro.reviews.map((r) => (
                  <Card key={r.id}>
                    <Stars value={r.rating} />
                    {r.comment && <p className="mt-2">“{r.comment}”</p>}
                    <p className="mt-2 text-sm text-muted">{r.client.name.split(" ")[0]}</p>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-6 lg:h-fit">
          <Card>
            <h2 className="text-lg font-semibold">{show.nextSlots ? "Próximos horários livres" : cta}</h2>
            {first && <p className="text-sm text-muted">{first.name}</p>}
            {!show.nextSlots ? null : slots.length === 0 ? <p className="mt-3 text-sm text-muted">Sem horários nos próximos dias.</p> : (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {slots.map((s) => (
                  <Link key={s.toISOString()} href={`/p/${pro.slug}/agendar?servico=${first!.id}&horario=${encodeURIComponent(s.toISOString())}`} className="rounded-xl border border-line px-3 py-2 text-center text-sm hover:border-primary hover:bg-surface">
                    <span className="block capitalize text-muted">{fmt(s, "EEE d/MM", pro.timezone)}</span>
                    <span className="font-semibold">{fmt(s, "HH:mm", pro.timezone)}</span>
                  </Link>
                ))}
              </div>
            )}
            {cfg.careTypes.length > 0 && (
              <Link href={`/p/${pro.slug}/agendar`} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary font-semibold text-on-primary hover:bg-primary-hover">{cta} com triagem</Link>
            )}
            {first && <Link href={`/p/${pro.slug}/agendar?servico=${first.id}`} className={`mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl font-semibold ${cfg.careTypes.length ? "border border-line bg-card text-primary hover:bg-surface" : "bg-primary text-on-primary hover:bg-primary-hover"}`}>Ver todos os horários</Link>}
            {cfg.careTypes.length > 0 && <p className="mt-3 text-center text-xs text-muted">A triagem leva 1 minuto e indica o atendimento certo para você.</p>}
            <p className="mt-3 text-center text-xs text-muted">Cancelamento gratuito até {cfg.cancellationPolicy.minHoursBefore}h antes.</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
