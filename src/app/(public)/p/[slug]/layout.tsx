import { ProfessionTheme } from "@/components/profession-theme";
import { db } from "@/lib/db";
import { themeForProfile } from "@/lib/themes/load";

// Página pública do profissional (perfil, agendamento, confirmação) com o tema da profissão.
export default async function ProfessionalPublicLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pro = await db.professional.findFirst({ where: { slug, isPublic: true }, select: { profileId: true } });
  const theme = pro ? await themeForProfile(pro.profileId) : null;
  return (
    <>
      <ProfessionTheme theme={theme} />
      {children}
    </>
  );
}
