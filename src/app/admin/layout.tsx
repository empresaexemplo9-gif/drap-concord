import Link from "next/link";
import { Brand } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { logout } from "../(auth)/actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireUser(["PLATFORM_ADMIN"], "/entrar?next=/admin/perfis");
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3"><Brand href="/admin/perfis" /><span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-on-primary">Admin</span></div>
          <nav className="flex items-center gap-1 text-sm font-medium">
            <Link href="/admin/perfis" className="inline-flex min-h-11 items-center rounded-xl px-3 hover:bg-card">Perfis profissionais</Link>
            <Link href="/admin/moderacao" className="inline-flex min-h-11 items-center rounded-xl px-3 hover:bg-card">Moderação</Link>
            <form action={logout}><button className="min-h-11 rounded-xl px-3 text-muted hover:bg-card">Sair</button></form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
