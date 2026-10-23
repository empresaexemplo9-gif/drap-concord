import Link from "next/link";
import { Alert, Card, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { signupProfessional } from "../actions";

export const metadata = { title: "Criar conta de profissional" };

export default async function Cadastro({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <Card className="p-6 sm:p-8">
      <p className="text-sm font-semibold text-accent">14 dias grátis, sem cartão</p>
      <h1 className="mt-1 text-2xl font-semibold">Organize seus atendimentos em minutos</h1>
      <p className="mt-1 text-sm text-muted">Você escolhe sua profissão e a plataforma já chega configurada para ela.</p>
      <form action={signupProfessional} className="mt-6 space-y-4">
        {erro && <Alert tone="danger">{erro}</Alert>}
        <Field label="Seu nome" htmlFor="name">
          <Input id="name" name="name" autoComplete="name" required />
        </Field>
        <Field label="E-mail" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Senha" htmlFor="password" hint="Pelo menos 8 caracteres.">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <label className="flex items-start gap-3 text-sm text-muted">
          <input type="checkbox" name="consent" required className="mt-1 size-5 accent-[var(--primary)]" />
          <span>
            Li e aceito os <Link href="/termos" className="font-semibold text-primary underline">termos de uso</Link> e a{" "}
            <Link href="/privacidade" className="font-semibold text-primary underline">política de privacidade</Link> (LGPD).
          </span>
        </label>
        <SubmitButton className="w-full" pendingText="Criando…">Criar minha conta</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Já tem conta? <Link href="/entrar" className="font-semibold text-primary hover:underline">Entrar</Link>
      </p>
    </Card>
  );
}
