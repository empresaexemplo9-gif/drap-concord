import { getUser } from "@/lib/auth";
import { themeForUser } from "@/lib/themes/load";
import { ProfessionTheme } from "./profession-theme";

/** Veste a página com o tema da conta logada (profissional, equipe ou cliente). */
export async function UserTheme() {
  return <ProfessionTheme theme={await themeForUser(await getUser())} />;
}
