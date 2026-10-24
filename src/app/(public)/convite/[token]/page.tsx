import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { logoUrl, parseBrand } from "@/lib/brand";
import { Alert, Badge, ButtonLink, Card, EmptyState, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ProfessionTheme } from "@/components/profession-theme";
import { getUser } from "@/lib/auth";
import { findInvite } from "@/lib/invites";
import { themeForProfessional } from "@/lib/themes/load";
import { login, logout, signupClient } from "../../../(auth)/actions";
import { linkInvite } from "./actions";

export const metadata = { title: "Convite", robots: { index: false } };

export default async function Convite({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ erro?: string; modo?: string }> }) {
  const { token } = await params;
  const { erro, modo } = await searchParams;
  const invite = await findInvite(token);
  if (!invite) {
    return (
      <div className="gutter py-16">
        <EmptyState title="Convite indisponível" text="Este link expirou, já foi usado ou foi desativado. Peça um novo link ao seu profissional." action={<ButtonLink href="/">Buscar profissionais</ButtonLink>} />
      </div>
    );
  }
  const pro = invite.professional;
  const term = (pro.profile.config as { terminology?: { professional?: string } }).terminology?.professional ?? pro.profile.name;
  const [theme, user, logo] = await Promise.all([themeForProfessional(pro), getUser(), logoUrl(pro.id)]);
  const business = parseBrand(pro.brand).businessName;
  const first = invite.client?.name.split(" ")[0];
  const hasAccount = modo === "entrar";

  return (
    <>
      <ProfessionTheme theme={theme} />
      <div className="gutter grid gap-8 py-10 lg:grid-cols-[1fr_minmax(0,32rem)] lg:items-start lg:py-16">
        <section className="space-y-5 rounded-3xl border border-line/60 bg-card/85 p-6 shadow-soft sm:p-8">
          <Badge tone="info">Convite · Acesso 2</Badge>
          <div className="flex items-center gap-4">
            <BrandMark name={business ?? pro.displayName} logoUrl={logo} size={64} />
            <div>
              <p className="text-sm text-muted">{business ? `${pro.displayName} · ${term}` : term}</p>
              <p className="text-xl font-semibold">{business ?? pro.displayName}</p>
            </div>
          </div>
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
            {first ? `${first}, ` : ""}{pro.displayName} convidou você para ter sua conta na DRAP Concord
          </h1>
          <ul className="space-y-2 text-muted">
            <li>✓ Agende, confirme e remarque seus horários com {pro.displayName.split(" ")[0]}.</li>
            <li>✓ Receba lembretes e acompanhe tudo em um só lugar.</li>
            <li>✓ Use a mesma conta para encontrar e agendar outros serviços.</li>
          </ul>
          <p className="text-sm text-muted">Sua conta é sua: você decide seus dados e pode pedir a exclusão quando quiser (LGPD).</p>
        </section>

        <Card className="p-6 sm:p-8">
          {erro && <div className="mb-4"><Alert tone="danger">{erro}</Alert></div>}
          {user?.role === "CLIENT" ? (
            <>
              <h2 className="text-xl font-semibold">Você já tem conta</h2>
              <p className="mt-1 text-sm text-muted">Entrou como {user.name} ({user.email}). Ligue sua conta a {pro.displayName} com um clique.</p>
              <form action={linkInvite} className="mt-6">
                <input type="hidden" name="convite" value={token} />
                <SubmitButton className="w-full" pendingText="Ligando…">Aceitar convite</SubmitButton>
              </form>
              <form action={logout} className="mt-3 text-center">
                <button className="min-h-11 text-sm font-semibold text-primary">Não é você? Sair</button>
              </form>
            </>
          ) : user ? (
            <>
              <h2 className="text-xl font-semibold">Este convite é para clientes</h2>
              <p className="mt-1 text-sm text-muted">Você está em uma conta de profissional ou administração. Convites criam contas de cliente (Acesso 2). Saia para continuar.</p>
              <form action={logout} className="mt-6"><SubmitButton className="w-full" variant="secondary">Sair</SubmitButton></form>
            </>
          ) : hasAccount ? (
            <>
              <h2 className="text-xl font-semibold">Entrar e aceitar</h2>
              <p className="mt-1 text-sm text-muted">Use sua conta de cliente; ela fica ligada a {pro.displayName}.</p>
              <form action={login} className="mt-6 space-y-4">
                <input type="hidden" name="convite" value={token} />
                <Field label="E-mail" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
                <Field label="Senha" htmlFor="password"><Input id="password" name="password" type="password" autoComplete="current-password" required /></Field>
                <SubmitButton className="w-full" pendingText="Entrando…">Entrar e aceitar</SubmitButton>
              </form>
              <p className="mt-6 text-center text-sm text-muted">
                Ainda não tem conta? <Link href={`/convite/${token}`} className="font-semibold text-primary hover:underline">Criar agora</Link>
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold">Crie sua conta</h2>
              <p className="mt-1 text-sm text-muted">Leva menos de um minuto.</p>
              <form action={signupClient} className="mt-6 space-y-4">
                <input type="hidden" name="convite" value={token} />
                <Field label="Seu nome" htmlFor="name"><Input id="name" name="name" autoComplete="name" defaultValue={invite.client?.name} required /></Field>
                <Field label="E-mail" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" defaultValue={invite.client?.email ?? ""} required /></Field>
                <Field label="Celular (WhatsApp)" htmlFor="phone"><Input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={invite.client?.phone ?? ""} required /></Field>
                <Field label="Senha" htmlFor="password" hint="Pelo menos 8 caracteres."><Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required /></Field>
                <label className="flex items-start gap-3 text-sm text-muted">
                  <input type="checkbox" name="consent" required className="mt-1 size-5 accent-[var(--primary)]" />
                  <span>
                    Li e aceito os <Link href="/termos" className="font-semibold text-primary underline">termos de uso</Link> e a{" "}
                    <Link href="/privacidade" className="font-semibold text-primary underline">política de privacidade</Link> (LGPD).
                  </span>
                </label>
                <SubmitButton className="w-full" pendingText="Criando…">Criar conta e aceitar</SubmitButton>
              </form>
              <p className="mt-6 text-center text-sm text-muted">
                Já tem conta? <Link href={`/convite/${token}?modo=entrar`} className="font-semibold text-primary hover:underline">Entrar e aceitar</Link>
              </p>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
