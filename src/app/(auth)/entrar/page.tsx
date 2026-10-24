import Link from "next/link";
import { Alert, Card, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { login } from "../actions";

export const metadata = { title: "Entrar" };

export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string; next?: string }> }) {
  const { erro, next } = await searchParams;
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-semibold">Que bom te ver de novo</h1>
      <p className="mt-1 text-sm text-muted">Entre para ver sua agenda e seus atendimentos.</p>
      <form action={login} className="mt-6 space-y-4">
        {erro && <Alert tone="danger">{erro}</Alert>}
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="E-mail" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Senha" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <SubmitButton className="w-full" pendingText="Entrando…">Entrar</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Ainda não tem conta?{" "}
        <Link href="/cadastro/cliente" className="font-semibold text-primary underline-offset-4 hover:underline">Quero agendar</Link>
        {" · "}
        <Link href="/cadastro" className="font-semibold text-primary underline-offset-4 hover:underline">Sou profissional</Link>
      </p>
    </Card>
  );
}
