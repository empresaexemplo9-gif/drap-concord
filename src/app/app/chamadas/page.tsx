import { CallsHome } from "@/components/calls-home";
import { requireProfessional } from "@/lib/auth";

export const metadata = { title: "Chamadas" };

export default async function ChamadasProfissional({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { user } = await requireProfessional();
  return <CallsHome user={user} from="/app/chamadas" erro={(await searchParams).erro} />;
}
