import { BottomNav, type NavItem } from "@/components/app-nav";
import { Brand } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { logout } from "../(auth)/actions";

const items: NavItem[] = [
  { href: "/minha-conta", label: "Agendamentos", icon: "calendar" },
  { href: "/", label: "Buscar", icon: "home" },
  { href: "/minha-conta/dados", label: "Meus dados", icon: "user" },
];

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["CLIENT"], "/entrar?next=/minha-conta");
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Brand href="/minha-conta" />
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">{user.name}</span>
            <form action={logout}><button className="min-h-11 rounded-xl px-3 font-semibold text-primary hover:bg-surface">Sair</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-8">{children}</main>
      <BottomNav items={items} />
    </div>
  );
}
