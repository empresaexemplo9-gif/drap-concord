import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { logout } from "../../(auth)/actions";

const links = [
  ["/app/chamadas", "Chamadas de áudio e vídeo"],
  ["/app/servicos", "Serviços e preços"],
  ["/app/horarios", "Horários e bloqueios"],
  ["/app/relatorios", "Relatórios"],
  ["/app/perfil", "Meu perfil e página pública"],
  ["/app/marca", "Minha marca"],
  ["/app/atendimento", "Como atendo"],
  ["/app/notificacoes", "Notificações"],
  ["/app/convites", "Convidar clientes"],
  ["/vitrine", "Vitrine pública"],
];

export default function Mais() {
  return (
    <>
      <PageHeader title="Mais" />
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {links.map(([href, label]) => (
          <li key={href}><Link href={href} className="flex min-h-14 items-center justify-between px-5 font-medium">{label}<span aria-hidden className="text-muted">›</span></Link></li>
        ))}
      </ul>
      <form action={logout} className="mt-6"><button className="min-h-11 font-semibold text-danger">Sair da conta</button></form>
    </>
  );
}
