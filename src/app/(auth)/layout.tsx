import { Brand, Logo } from "@/components/ui";

const points = [
  "Agenda, clientes e fichas no mesmo lugar",
  "Lembretes e confirmação automática",
  "Página própria para receber agendamentos",
  "Configurado para a sua profissão em minutos",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="gutter relative hidden flex-col justify-between overflow-hidden bg-primary py-10 text-on-primary lg:flex">
        <div className="[&_span]:!text-on-primary [&_svg]:!text-on-primary"><Brand /></div>
        <div>
          <h2 className="text-4xl font-semibold leading-tight xl:text-5xl">A agenda que entende o seu jeito de atender.</h2>
          <ul className="mt-8 space-y-3 text-lg opacity-90">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-3"><span aria-hidden className="inline-block size-2 rounded-full bg-accent" />{p}</li>
            ))}
          </ul>
        </div>
        <p className="text-sm opacity-75">Saúde, jurídico, esporte, educação, beleza, consultoria e muito mais.</p>
        <Logo size={520} className="pointer-events-none absolute -bottom-24 -right-24 !text-on-primary opacity-[0.06]" />
      </aside>
      <div className="flex flex-col">
        <header className="gutter py-5 lg:hidden"><Brand /></header>
        <main className="gutter flex flex-1 items-center py-10">
          <div className="w-full [&>div]:border-0 [&>div]:bg-transparent [&>div]:p-0 [&>div]:shadow-none sm:[&>div]:p-0">{children}</div>
        </main>
      </div>
    </div>
  );
}
