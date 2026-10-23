import { Showcase } from "@/components/showcase";
import type { SearchParams } from "@/lib/search";

export const dynamic = "force-dynamic";
// Mesma vitrine da página inicial, acessível pelo menu do profissional.
export const metadata = { title: "Vitrine pública", robots: { index: false }, alternates: { canonical: "/" } };

export default async function Vitrine({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <Showcase sp={await searchParams} basePath="/vitrine" />;
}
