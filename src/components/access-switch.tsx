import Link from "next/link";
import { cx } from "./ui";

const options = [
  { href: "/cadastro", key: "pro", title: "Acesso 1", text: "Sou profissional" },
  { href: "/cadastro/cliente", key: "client", title: "Acesso 2", text: "Quero encontrar e agendar serviços" },
] as const;

/** Escolha do tipo de conta no cadastro. */
export function AccessSwitch({ active }: { active: "pro" | "client" }) {
  return (
    <nav aria-label="Tipo de conta" className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-surface p-1.5">
      {options.map((o) => (
        <Link
          key={o.key}
          href={o.href}
          aria-current={active === o.key ? "page" : undefined}
          className={cx("rounded-xl px-3 py-2.5 text-left", active === o.key ? "bg-card shadow-sm" : "text-muted hover:text-ink")}
        >
          <span className="block text-xs font-semibold uppercase tracking-wide text-accent">{o.title}</span>
          <span className="block text-sm font-semibold">{o.text}</span>
        </Link>
      ))}
    </nav>
  );
}
