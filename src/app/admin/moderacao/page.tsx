import { Button, Card, EmptyState, PageHeader, Stars } from "@/components/ui";
import { db } from "@/lib/db";
import { moderateReview, verifyRegistry } from "../actions";

export const metadata = { title: "Moderação" };

export default async function Moderacao() {
  const [reviews, pros] = await Promise.all([
    db.review.findMany({ where: { status: "PENDING" }, include: { professional: true, client: true }, orderBy: { createdAt: "asc" } }),
    db.professional.findMany({ where: { registryVerified: false, registryNumber: { not: null } }, include: { profile: true } }),
  ]);
  return (
    <>
      <PageHeader title="Moderação" subtitle="Avaliações antes de ir para a vitrine e verificação de registros profissionais." />
      <h2 className="mb-3 text-xl font-semibold">Registros a verificar</h2>
      {pros.length === 0 ? <EmptyState title="Nenhum registro pendente" text="Novos profissionais aparecem aqui." /> : (
        <div className="mb-10 space-y-3">
          {pros.map((p) => (
            <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="font-semibold">{p.displayName}</p><p className="text-sm text-muted">{p.profile.name} · {p.registryNumber}</p></div>
              <div className="flex gap-2">
                <form action={verifyRegistry}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="decision" value="approve" /><Button>Verificar</Button></form>
              </div>
            </Card>
          ))}
        </div>
      )}
      <h2 className="mb-3 mt-10 text-xl font-semibold">Avaliações pendentes</h2>
      {reviews.length === 0 ? <EmptyState title="Nada para moderar" text="Avaliações novas aparecem aqui." /> : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <Card key={r.id}>
              <Stars value={r.rating} />
              <p className="mt-1">{r.comment ?? <span className="text-muted">Sem comentário</span>}</p>
              <p className="text-sm text-muted">{r.client.name} sobre {r.professional.displayName}</p>
              <div className="mt-3 flex gap-2">
                <form action={moderateReview}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="approve" /><Button>Aprovar</Button></form>
                <form action={moderateReview}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="reject" /><Button variant="secondary">Recusar</Button></form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
