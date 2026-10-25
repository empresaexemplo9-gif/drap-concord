import Link from "next/link";
import { Brand, ButtonLink } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { getUser } from "@/lib/auth";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  const home = user?.role === "CLIENT" ? "/minha-conta" : user?.role === "PLATFORM_ADMIN" ? "/admin/perfis" : "/app";
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="relative z-10 border-b border-line/60 bg-card/80">
        <div className="gutter flex items-center justify-between gap-3 py-4">
          <Brand />
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/baixar" className="hidden min-h-11 items-center rounded-xl px-3 font-semibold text-primary hover:bg-surface md:inline-flex">Baixar o app</Link>
            <ThemeToggle />
            {user ? (
              <ButtonLink href={home} variant="secondary">Minha área</ButtonLink>
            ) : (
              <>
                <Link href="/entrar" className="inline-flex min-h-11 items-center rounded-xl px-3 font-semibold text-primary hover:bg-surface">Entrar</Link>
                <span className="hidden sm:block"><ButtonLink href="/cadastro" className="whitespace-nowrap">Sou profissional</ButtonLink></span>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line/60 bg-card/80 py-8 text-sm text-muted">
        <div className="gutter flex flex-wrap items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} DRAP Concord</p>
          <nav className="flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/baixar" className="hover:text-ink">Baixar o app</Link>
            <Link href="/cadastro" className="hover:text-ink">Para profissionais</Link>
            <Link href="/termos" className="hover:text-ink">Termos de uso</Link>
            <Link href="/privacidade" className="hover:text-ink">Privacidade</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
