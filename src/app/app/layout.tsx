import Link from "next/link";
import { BottomNav, Icon, SideNav, type NavItem } from "@/components/app-nav";
import { Brand, ButtonLink } from "@/components/ui";
import { requireProfessional } from "@/lib/auth";
import { db } from "@/lib/db";
import { logout } from "../(auth)/actions";

const items: NavItem[] = [
  { href: "/app", label: "Hoje", icon: "home" },
  { href: "/app/agenda", label: "Agenda", icon: "calendar" },
  { href: "/app/clientes", label: "Clientes", icon: "users" },
  { href: "/app/regras", label: "Regras", icon: "bolt" },
  { href: "/app/servicos", label: "Serviços", icon: "briefcase" },
  { href: "/app/horarios", label: "Horários", icon: "clock" },
  { href: "/app/relatorios", label: "Relatórios", icon: "chart" },
  { href: "/app/perfil", label: "Meu perfil", icon: "user" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, professional } = await requireProfessional();
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  const mobile: NavItem[] = [
    items[0],
    items[1],
    items[2],
    items[3],
    { href: "/app/mais", label: "Mais", icon: "more" },
  ];

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-line bg-surface px-4 py-6 md:flex">
        <Brand href="/app" />
        <ButtonLink href="/app/agendar" className="w-full">+ Novo agendamento</ButtonLink>
        <SideNav items={items} />
        <div className="mt-auto space-y-1 text-sm">
          <p className="truncate px-3 font-medium">{professional.displayName}</p>
          <form action={logout}>
            <button className="min-h-11 w-full rounded-xl px-3 text-left text-muted hover:bg-card/60">Sair</button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur md:px-8">
          <div className="md:hidden"><Brand href="/app" /></div>
          <div className="hidden text-sm text-muted md:block">
            Sua página pública:{" "}
            <Link href={`/p/${professional.slug}`} className="font-medium text-primary hover:underline">/p/{professional.slug}</Link>
          </div>
          <Link href="/app/notificacoes" className="relative inline-flex size-11 items-center justify-center rounded-xl text-ink hover:bg-surface" aria-label={`Notificações${unread ? `, ${unread} não lidas` : ""}`}>
            <Icon name="bell" />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 min-w-5 rounded-full bg-accent px-1 text-center text-[11px] font-bold leading-5 text-white">{unread > 9 ? "9+" : unread}</span>
            )}
          </Link>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:px-8 md:pb-12">{children}</main>
        <Link href="/app/agendar" className="fixed bottom-20 right-4 z-30 inline-flex size-14 items-center justify-center rounded-full bg-primary text-2xl text-on-primary shadow-soft md:hidden" aria-label="Novo agendamento">+</Link>
      </div>
      <BottomNav items={mobile} />
    </div>
  );
}
