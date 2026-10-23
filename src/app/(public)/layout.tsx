import Link from "next/link";
import { Brand, ButtonLink } from "@/components/ui";
import { getUser } from "@/lib/auth";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  const home = user?.role === "CLIENT" ? "/minha-conta" : user?.role === "PLATFORM_ADMIN" ? "/admin/perfis" : "/app";
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <Brand />
          <nav className="flex items-center gap-1 text-sm">
            {user ? (
              <ButtonLink href={home} variant="secondary">Minha área</ButtonLink>
            ) : (
              <>
                <Link href="/entrar" className="inline-flex min-h-11 items-center rounded-xl px-3 font-semibold text-primary hover:bg-surface">Entrar</Link>
                <ButtonLink href="/cadastro" className="hidden sm:inline-flex">Sou profissional</ButtonLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line/60 py-8 text-sm text-muted">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4">
          <p>© {new Date().getFullYear()} DRAP Concord</p>
          <nav className="flex gap-4">
            <Link href="/cadastro" className="hover:text-ink">Para profissionais</Link>
            <Link href="/termos" className="hover:text-ink">Termos de uso</Link>
            <Link href="/privacidade" className="hover:text-ink">Privacidade</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
