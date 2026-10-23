import { Logo } from "@/components/ui";

export const metadata = { title: "Sem conexão" };

export default function Offline() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <Logo size={48} />
      <h1 className="mt-6 text-2xl font-semibold">Você está sem internet</h1>
      <p className="mt-2 text-muted">
        As páginas que você abriu recentemente continuam disponíveis. Assim que a conexão voltar, tudo se atualiza.
      </p>
    </main>
  );
}
