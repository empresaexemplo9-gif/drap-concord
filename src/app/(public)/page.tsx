import { redirect } from "next/navigation";
import { Showcase } from "@/components/showcase";
import { getUser } from "@/lib/auth";
import type { SearchParams } from "@/lib/search";

export const dynamic = "force-dynamic";

export default async function Inicio({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // Profissional logado vai direto para a própria área; a vitrine fica no menu.
  const user = await getUser();
  if (user?.role === "PROFESSIONAL") redirect("/app");
  return <Showcase sp={await searchParams} basePath="/" />;
}
