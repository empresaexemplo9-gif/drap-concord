import { CallsHome } from "@/components/calls-home";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Chamadas" };

export default async function ChamadasCliente({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const user = await requireUser(["CLIENT"]);
  return <CallsHome user={user} from="/minha-conta/chamadas" erro={(await searchParams).erro} />;
}
