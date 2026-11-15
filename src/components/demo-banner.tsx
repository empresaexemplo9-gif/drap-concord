import { getImpersonator, getUser } from "@/lib/auth";
import { DEMO_TTL_HOURS, isDemoUser } from "@/lib/demo";
import { endDemo, switchDemoView } from "@/app/demo-actions";

/**
 * Faixa no topo de todas as páginas durante a demonstração pública: deixa
 * claro que os dados são de exemplo, alterna entre a visão do profissional e
 * a do cliente e leva ao cadastro de verdade.
 */
export async function DemoBanner() {
  if (await getImpersonator()) return null;
  const user = await getUser();
  if (!isDemoUser(user)) return null;
  const asClient = user!.role === "CLIENT";
  const btn = "inline-flex min-h-9 items-center rounded-lg px-2.5 text-xs font-semibold sm:px-3 sm:text-sm";
  return (
    <div role="region" aria-label="Modo demonstração" className="gutter flex items-center gap-x-3 gap-y-2 border-b border-line bg-info-bg py-1.5 text-sm text-ink sm:flex-wrap sm:py-2">
      <p className="min-w-0 flex-1 truncate sm:whitespace-normal">
        <strong className="font-semibold text-primary">
          <span className="sm:hidden">Demonstração</span>
          <span className="hidden sm:inline">Modo demonstração</span>
        </strong>
        <span className="hidden text-muted sm:inline">
          {" "}· {asClient ? "você está vendo o portal como cliente de exemplo" : "dados fictícios, teste tudo à vontade"} · nada é enviado a pessoas reais e tudo some em {DEMO_TTL_HOURS}h
        </span>
      </p>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <form action={switchDemoView}>
          <button className={`${btn} border border-line bg-card text-primary hover:border-primary`}>
            <span className="sm:hidden">{asClient ? "Profissional" : "Ver cliente"}</span>
            <span className="hidden sm:inline">{asClient ? "Voltar ao profissional" : "Ver como meu cliente"}</span>
          </button>
        </form>
        <form action={endDemo}>
          <input type="hidden" name="para" value="cadastro" />
          <button className={`${btn} bg-primary text-on-primary hover:bg-primary-hover`}>
            <span className="sm:hidden">Criar conta</span>
            <span className="hidden sm:inline">Criar minha conta</span>
          </button>
        </form>
        <form action={endDemo}>
          <button className={`${btn} text-muted hover:text-ink`} aria-label="Sair da demonstração">
            <span className="sm:hidden">Sair</span>
            <span className="hidden sm:inline">Sair da demonstração</span>
          </button>
        </form>
      </div>
    </div>
  );
}
