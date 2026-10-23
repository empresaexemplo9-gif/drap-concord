import { ButtonLink, Logo } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <Logo size={48} />
      <h1 className="mt-6 text-2xl font-semibold">Não encontramos essa página</h1>
      <p className="mt-2 text-muted">O endereço pode ter mudado ou o conteúdo não está mais disponível.</p>
      <ButtonLink href="/" className="mt-6">Voltar ao início</ButtonLink>
    </main>
  );
}
