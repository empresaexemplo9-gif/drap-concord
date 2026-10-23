import { getImpersonator, getUser } from "@/lib/auth";
import { stopViewAs } from "@/app/view-as-actions";

const roleLabel = { PLATFORM_ADMIN: "admin", PROFESSIONAL: "profissional", CLIENT: "cliente" } as const;

/**
 * Selo flutuante mostrado enquanto um admin vê a plataforma como outro
 * usuário. Fica fixo no canto (acima da barra inferior no celular), sempre
 * visível ao rolar e sem deslocar o layout da página.
 */
export async function ViewAsBanner() {
  const admin = await getImpersonator();
  if (!admin) return null;
  const user = await getUser();
  return (
    <div
      className="fixed bottom-24 left-4 right-4 z-[60] flex items-center gap-3 rounded-2xl bg-accent py-2 pl-4 pr-2 text-sm font-medium text-white shadow-soft sm:right-auto sm:max-w-md md:bottom-4"
      role="status"
    >
      <span className="min-w-0">
        Vendo como <strong>{user?.name}</strong> ({user && roleLabel[user.role]}).
        <span className="block text-xs opacity-90">Ações aqui valem como se fosse essa pessoa.</span>
      </span>
      <form action={stopViewAs} className="ml-auto shrink-0">
        <button className="min-h-10 rounded-xl bg-white/20 px-3 font-semibold hover:bg-white/30">Voltar ao admin</button>
      </form>
    </div>
  );
}
