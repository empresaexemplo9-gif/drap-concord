import { BottomNav, type NavItem } from "@/components/app-nav";
import { Brand } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserTheme } from "@/components/user-theme";
import { requireUser } from "@/lib/auth";
import { accessLabel } from "@/lib/format";
import { logout } from "../(auth)/actions";

const items: NavItem[] = [
  { href: "/minha-conta", label: "Agendamentos", icon: "calendar" },
  { href: "/minha-conta/chamadas", label: "Chamadas", icon: "phone" },
  { href: "/vitrine", label: "Buscar serviços", icon: "store" },
  { href: "/minha-conta/dados", label: "Meus dados", icon: "user" },
];

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["CLIENT"], "/entrar?next=/minha-conta");
  return (
    <div className="min-h-dvh">
      <UserTheme />
      <header className="border-b border-line/60">
        <div className="gutter flex items-center justify-between py-4">
          <Brand href="/minha-conta" />
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">{user.name} · <span className="font-semibold text-accent">{accessLabel.CLIENT}</span></span>
            <ThemeToggle />
            <form action={logout}><button className="min-h-11 rounded-xl px-3 font-semibold text-primary hover:bg-surface">Sair</button></form>
          </div>
        </div>
      </header>
      <main className="gutter pb-28 pt-8">{children}</main>
      <BottomNav items={items} />
    </div>
  );
}
