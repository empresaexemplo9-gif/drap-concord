import { ProfessionTheme } from "@/components/profession-theme";
import { db } from "@/lib/db";
import { themeForProfessional } from "@/lib/themes/load";
import { getImpersonator } from "@/lib/auth";

// Página pública do profissional (perfil, agendamento, confirmação) com o tema da profissão.
export default async function ProfessionalPublicLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pro = await db.professional.findFirst({ where: { slug, ...((await getImpersonator()) ? {} : { isPublic: true }) }, select: { id: true, profileId: true, brand: true } });
  const theme = pro ? await themeForProfessional(pro) : null;
  return (
    <>
      <ProfessionTheme theme={theme} />
      {children}
    </>
  );
}
