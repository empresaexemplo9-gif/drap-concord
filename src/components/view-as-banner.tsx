import { getImpersonator, getUser } from "@/lib/auth";
import { stopViewAs } from "@/app/view-as-actions";

const roleLabel = { PLATFORM_ADMIN: "admin", PROFESSIONAL: "profissional", CLIENT: "cliente" } as const;

/** Faixa fixa mostrada enquanto um admin vê a plataforma como outro usuário. */
export async function ViewAsBanner() {
  const admin = await getImpersonator();
  if (!admin) return null;
  const user = await getUser();
  return (
    <div className="gutter relative z-50 flex flex-wrap items-center justify-between gap-2 bg-accent py-2 text-sm font-medium text-white" role="status">
      <span>
        Você está vendo como <strong>{user?.name}</strong> ({user && roleLabel[user.role]}). Tudo o que fizer aqui vale como se fosse essa pessoa.
      </span>
      <form action={stopViewAs}>
        <button className="min-h-9 rounded-lg bg-white/20 px-3 font-semibold hover:bg-white/30">Voltar ao admin</button>
      </form>
    </div>
  );
}
