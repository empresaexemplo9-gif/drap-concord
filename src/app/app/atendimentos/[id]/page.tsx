import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, Button, Card, PageHeader } from "@/components/ui";
import { DynamicFields } from "@/components/dynamic-fields";
import { TriageSummary } from "@/components/triage-summary";
import { db } from "@/lib/db";
import { outcomeOf } from "@/lib/triage/service";
import { SlotPicker } from "@/components/slot-picker";
import { SubmitButton } from "@/components/submit-button";
import { requireProfessional } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { tenant } from "@/lib/tenant";
import { availableSlots } from "@/lib/booking";
import { canSeeRecords, professionalConfig } from "@/lib/profiles/registry";
import { dateLong, modalityLabel, money, statusLabel, statusTone, time, fmt } from "@/lib/format";
import { rescheduleAppointment, saveRecord, setStatus } from "../../actions";

export const metadata = { title: "Atendimento" };

const okMsg: Record<string, string> = {
  criado: "Agendamento criado. O cliente foi avisado.",
  remarcado: "Remarcado com sucesso. O cliente foi avisado.",
  registro: "Registro salvo.",
};

export default async function Atendimento({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { id } = await params;
  const { ok, erro } = await searchParams;
  const { professional, orgId, memberRole, user } = await requireProfessional();
  const appt = await tenant(orgId).appointments.get(id);
  if (!appt) notFound();
  const tz = professional.timezone;
  const cfg = await professionalConfig(professional);
  const showRecords = canSeeRecords(memberRole, cfg);
  const records = showRecords ? (await tenant(orgId).records.forClient(appt.clientId)).filter((r) => r.appointmentId === appt.id) : [];
  if (records.length) await audit({ orgId, userId: user.id, action: "record.viewed", entity: "Appointment", entityId: appt.id });
  const triage = await db.triageResponse.findFirst({ where: { appointmentId: appt.id, orgId } });
  if (triage && showRecords) await audit({ orgId, userId: user.id, action: "triage.viewed", entity: "TriageResponse", entityId: triage.id });
  const active = appt.status === "PENDING" || appt.status === "CONFIRMED";
  const slots = active ? await availableSlots(professional.id, appt.serviceId, 21) : [];
  const allFields = cfg.recordTemplate.sections.flatMap((s) => s.fields);

  const StatusBtn = ({ status, label, variant = "secondary" }: { status: string; label: string; variant?: "primary" | "secondary" | "danger" }) => (
    <form action={setStatus}>
      <input type="hidden" name="id" value={appt.id} />
      <input type="hidden" name="status" value={status} />
      <Button variant={variant} className="w-full">{label}</Button>
    </form>
  );

  return (
    <>
      <Link href="/app/agenda" className="mb-3 inline-block text-sm font-semibold text-primary">← Agenda</Link>
      <PageHeader title={appt.client.name} subtitle={`${appt.service.name} · ${dateLong(appt.startsAt, tz)}, ${time(appt.startsAt, tz)} às ${time(appt.endsAt, tz)}`} action={<Badge tone={statusTone[appt.status]}>{statusLabel[appt.status]}</Badge>} />
      {ok && okMsg[ok] && <div className="mb-4"><Alert tone="success">{okMsg[ok]}</Alert></div>}
      {erro && <div className="mb-4"><Alert tone="danger">{erro}</Alert></div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <Card className="space-y-2 text-sm">
            <p><span className="text-muted">Modalidade:</span> {modalityLabel[appt.modality]}</p>
            <p><span className="text-muted">Valor:</span> {money(appt.service.priceCents)}</p>
            {appt.modality === "ONLINE" && <p><span className="text-muted">Sala de vídeo:</span> o link é gerado ao integrar o provedor de vídeo.</p>}
            {appt.notes && <p><span className="text-muted">Observações:</span> {appt.notes}</p>}
            {appt.cancelReason && <p><span className="text-muted">Motivo:</span> {appt.cancelReason}</p>}
            <Link href={`/app/clientes/${appt.clientId}`} className="inline-block pt-2 font-semibold text-primary">Ver ficha de {appt.client.name.split(" ")[0]} →</Link>
          </Card>

          {triage && (
            <Card>
              <h2 className="mb-3 text-lg font-semibold">Triagem</h2>
              <TriageSummary outcome={outcomeOf(triage)} careTypeName={triage.careTypeName} audience="professional" showAnswers={showRecords} />
              {!showRecords && <p className="mt-3 text-xs text-muted">As respostas da triagem são sigilosas para o seu papel.</p>}
            </Card>
          )}

          {(active || appt.status === "DONE" || appt.status === "NO_SHOW") && (
            <Card>
              <h2 className="mb-3 text-lg font-semibold">Atualizar status</h2>
              <div className="grid grid-cols-2 gap-2">
                {appt.status === "PENDING" && <StatusBtn status="CONFIRMED" label="Confirmar" variant="primary" />}
                {appt.status !== "DONE" && <StatusBtn status="DONE" label="Realizado" variant={appt.status === "CONFIRMED" ? "primary" : "secondary"} />}
                {appt.status !== "NO_SHOW" && <StatusBtn status="NO_SHOW" label="Marcar falta" />}
                {active && <StatusBtn status="CANCELED_BY_PROFESSIONAL" label="Cancelar" variant="danger" />}
              </div>
              <p className="mt-3 text-xs text-muted">Ao marcar falta, as regras automáticas do seu perfil são avaliadas. Cancelamentos automáticos sempre pedem sua confirmação, a menos que você mude a regra.</p>
            </Card>
          )}

          {active && (
            <Card>
              <details>
                <summary className="cursor-pointer text-lg font-semibold">Remarcar</summary>
                <form action={rescheduleAppointment} className="mt-4 space-y-4">
                  <input type="hidden" name="id" value={appt.id} />
                  <SlotPicker slots={slots} tz={tz} max={7} />
                  <SubmitButton className="w-full" pendingText="Remarcando…">Remarcar</SubmitButton>
                </form>
              </details>
            </Card>
          )}
        </div>

        <Card>
          <h2 className="mb-1 text-lg font-semibold">{cfg.terminology.record}</h2>
          {!showRecords ? (
            <p className="text-sm text-muted">Seu papel não tem acesso ao registro deste atendimento (sigilo definido pelo perfil profissional).</p>
          ) : (
            <>
              <p className="mb-4 text-xs text-muted">Acesso registrado em log de auditoria.{cfg.compliance.confidentiality === "SIGILOSO" && " Conteúdo sigiloso."}</p>
              {records.map((r) => (
                <div key={r.id} className="mb-4 rounded-xl bg-surface p-4 text-sm">
                  <p className="mb-2 text-xs text-muted">Registrado em {fmt(r.createdAt, "dd/MM/yyyy HH:mm", tz)}</p>
                  <dl className="space-y-2">
                    {allFields.filter((f) => (r.data as Record<string, unknown>)[f.key]).map((f) => {
                      const v = (r.data as Record<string, unknown>)[f.key];
                      return <div key={f.key}><dt className="font-semibold">{f.label}</dt><dd className="whitespace-pre-wrap text-ink">{Array.isArray(v) ? v.join(", ") : String(v)}</dd></div>;
                    })}
                  </dl>
                </div>
              ))}
              <form action={saveRecord} className="space-y-5">
                <input type="hidden" name="appointmentId" value={appt.id} />
                <DynamicFields template={cfg.recordTemplate} />
                <SubmitButton pendingText="Salvando…">{records.length ? "Adicionar novo registro" : "Salvar registro"}</SubmitButton>
              </form>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
