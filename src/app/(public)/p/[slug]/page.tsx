import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, Badge, Card, Stars } from "@/components/ui";
import { db } from "@/lib/db";
import { availableSlots } from "@/lib/booking";
import { professionalConfig } from "@/lib/profiles/registry";
import { fmt, modalityLabel, money } from "@/lib/format";

async function load(slug: string) {
  return db.professional.findFirst({
    where: { slug, isPublic: true },
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
  const title = `${pro.displayName}, ${pro.headline ?? pro.profile.name}${pro.city ? ` em ${pro.city}` : ""}`;
  const description = pro.bio?.slice(0, 155) ?? `Agende online com ${pro.displayName}.`;
  return { title, description, alternates: { canonical: `/p/${pro.slug}` }, openGraph: { title, description, type: "profile" } };
}

export default async function PerfilPublico({ params }: { params: Promise<{ slug: string }> }) {
  const pro = await load((await params).slug);
  if (!pro) notFound();
  const cfg = await professionalConfig(pro);
  const first = pro.services[0];
  const slots = first ? (await availableSlots(pro.id, first.id, 14)).slice(0, 8) : [];
  const rating = pro.reviews.length ? pro.reviews.reduce((s, r) => s + r.rating, 0) / pro.reviews.length : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: pro.displayName,
    description: pro.bio ?? undefined,
    address: pro.city ? { "@type": "PostalAddress", addressLocality: pro.city, addressCountry: "BR" } : undefined,
    aggregateRating: rating ? { "@type": "AggregateRating", ratingValue: rating.toFixed(1), reviewCount: pro.reviews.length } : undefined,
    makesOffer: pro.services.map((s) => ({ "@type": "Offer", name: s.name, price: (s.priceCents / 100).toFixed(2), priceCurrency: "BRL" })),
  };

  return (
    <div className="gutter py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="grid gap-8 lg:grid-cols-[1fr_380px] 2xl:grid-cols-[1fr_440px] xl:gap-12">
        <div className="space-y-8">
          <div className="flex gap-5">
            <Avatar name={pro.displayName} size={96} />
            <div>
              <p className="text-sm font-semibold text-accent">{cfg.category}</p>
              <h1 className="text-3xl font-semibold sm:text-4xl">{pro.displayName}</h1>
              <p className="mt-1 text-muted">{pro.headline ?? pro.profile.name}{pro.city && ` · ${pro.city}`}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {pro.registryVerified && <Badge tone="success">✓ {cfg.registry?.label ?? "Registro"} verificado{pro.registryNumber && `: ${pro.registryNumber}`}</Badge>}
                {rating && <span className="inline-flex items-center gap-1 text-sm"><Stars value={rating} /> {rating.toFixed(1)} <span className="text-muted">({pro.reviews.length} avaliações)</span></span>}
              </div>
            </div>
          </div>

          {pro.bio && (
            <section>
              <h2 className="mb-2 text-xl font-semibold">Sobre</h2>
              <p className="whitespace-pre-line leading-relaxed text-ink">{pro.bio}</p>
              {pro.specialties.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{pro.specialties.map((s) => <Badge key={s}>{s}</Badge>)}</div>}
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
                    <span className="font-semibold">{money(s.priceCents)}</span>
                    <Link href={`/p/${pro.slug}/agendar?servico=${s.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary-hover">Agendar</Link>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {pro.reviews.length > 0 && (
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
            <h2 className="text-lg font-semibold">Próximos horários livres</h2>
            {first && <p className="text-sm text-muted">{first.name}</p>}
            {slots.length === 0 ? <p className="mt-3 text-sm text-muted">Sem horários nos próximos dias.</p> : (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {slots.map((s) => (
                  <Link key={s.toISOString()} href={`/p/${pro.slug}/agendar?servico=${first!.id}&horario=${encodeURIComponent(s.toISOString())}`} className="rounded-xl border border-line px-3 py-2 text-center text-sm hover:border-primary hover:bg-surface">
                    <span className="block capitalize text-muted">{fmt(s, "EEE d/MM", pro.timezone)}</span>
                    <span className="font-semibold">{fmt(s, "HH:mm", pro.timezone)}</span>
                  </Link>
                ))}
              </div>
            )}
            {first && <Link href={`/p/${pro.slug}/agendar?servico=${first.id}`} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary font-semibold text-on-primary hover:bg-primary-hover">Ver todos os horários</Link>}
            <p className="mt-3 text-center text-xs text-muted">Cancelamento gratuito até {cfg.cancellationPolicy.minHoursBefore}h antes.</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
