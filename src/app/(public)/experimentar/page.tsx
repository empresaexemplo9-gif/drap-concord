import Link from "next/link";
import { Alert, Badge, Card, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { publishedProfiles } from "@/lib/profiles/registry";
import { getUser } from "@/lib/auth";
import { DEMO_TTL_HOURS, isDemoUser } from "@/lib/demo";
import { modalityLabel, money } from "@/lib/format";
import { startDemo } from "@/app/demo-actions";

export const metadata = {
  title: "Testar sem cadastro",
  description: "Experimente a DRAP Concord como profissional, sem cadastro: agenda, clientes, fichas, regras, página pública, chamadas e portal do cliente com dados de exemplo.",
};

const tools = [
  ["Agenda", "semana e lista, encaixes, confirmações e faltas"],
  ["Clientes", "ficha, linha do tempo, etiquetas e funil"],
  ["Registro do atendimento", "ficha pronta para a sua profissão"],
  ["Regras automáticas", "avisos de faltas e retornos, com aprovação"],
  ["Página pública", "seus serviços, horários livres e avaliações"],
  ["Minha marca", "cores, fonte, logo e fundo da sua página"],
  ["Chamadas de vídeo", "atenda online pela própria plataforma"],
  ["Portal do cliente", "veja o que seu cliente vê ao agendar"],
] as const;

export default async function Experimentar({ searchParams }: { searchParams: Promise<{ erro?: string; categoria?: string }> }) {
  const { erro, categoria } = await searchParams;
  const [profiles, user] = await Promise.all([publishedProfiles(), getUser()]);
  const cats = [...new Set(profiles.map((p) => p.config.category))].sort();
  const shown = categoria ? profiles.filter((p) => p.config.category === categoria) : profiles;
  const loggedIn = user && !isDemoUser(user);

  return (
    <div className="gutter py-12 sm:py-16">
      <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-end">
        <div>
          <p className="text-sm font-semibold text-accent">Sem cadastro, sem cartão</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-[1.1] sm:text-5xl">Teste a plataforma como se fosse sua</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            Escolha a sua profissão e entre direto no app do profissional, já com serviços, clientes e agenda de exemplo. Use todas as ferramentas à vontade: nada é enviado a pessoas reais e tudo some em {DEMO_TTL_HOURS} horas.
          </p>
        </div>
        <Card>
          <p className="text-sm font-semibold text-ink">O que dá para testar</p>
          <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {tools.map(([t, d]) => (
              <li key={t} className="flex gap-2">
                <span aria-hidden className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-accent" />
                <span><strong className="font-semibold">{t}</strong> <span className="text-muted">· {d}</span></span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {erro && <div className="mt-8"><Alert tone="danger">{erro}</Alert></div>}
      {loggedIn && (
        <div className="mt-8">
          <Alert tone="warning">Você está conectado como {user.name}. Ao abrir uma demonstração, sua conta é desconectada neste aparelho (é só entrar de novo depois).</Alert>
        </div>
      )}

      <div className="mt-10 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-2xl font-semibold">Escolha a sua profissão</h2>
        <nav aria-label="Filtrar por área" className="flex flex-wrap gap-2">
          <Link href="/experimentar" className={`rounded-full border px-3.5 py-1.5 text-sm ${!categoria ? "border-primary bg-primary text-on-primary" : "border-line bg-card hover:border-primary"}`}>Todas</Link>
          {cats.map((c) => (
            <Link key={c} href={`/experimentar?categoria=${encodeURIComponent(c)}`} className={`rounded-full border px-3.5 py-1.5 text-sm ${categoria === c ? "border-primary bg-primary text-on-primary" : "border-line bg-card hover:border-primary"}`}>{c}</Link>
          ))}
        </nav>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((p) => (
          <Card key={p.id} role="group" aria-label={p.name} className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">{p.config.category}</p>
              <h3 className="mt-1 text-xl font-semibold">{p.name}</h3>
              <p className="mt-1 text-sm text-muted">
                Você atende {p.config.terminology.client.plural.toLowerCase()} e registra cada {p.config.terminology.appointment.singular.toLowerCase()} na ficha &ldquo;{p.config.recordTemplate.name}&rdquo;.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Serviços que já vêm prontos</p>
              <ul className="mt-2 divide-y divide-line rounded-xl border border-line text-sm">
                {p.config.services.map((s) => (
                  <li key={s.name} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.name}</span>
                      <span className="text-xs text-muted">{s.durationMin} min · {modalityLabel[s.modality]}</span>
                    </span>
                    <Badge>{s.priceCents ? money(s.priceCents) : "a combinar"}</Badge>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">Na demonstração você pode mudar nomes, preços e duração, e criar novos serviços.</p>
            </div>
            <form action={startDemo} className="mt-auto space-y-2">
              <input type="hidden" name="perfil" value={p.key} />
              <label className="sr-only" htmlFor={`nome-${p.key}`}>Seu nome (opcional)</label>
              <Input id={`nome-${p.key}`} name="nome" maxLength={60} placeholder="Seu nome (opcional)" autoComplete="name" />
              <SubmitButton className="w-full" pendingText="Preparando…">Testar como {p.name}</SubmitButton>
            </form>
          </Card>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-muted">
        Gostou? <Link href="/cadastro" className="font-semibold text-primary hover:underline">Crie sua conta de verdade</Link> com 14 dias grátis.
      </p>
    </div>
  );
}
