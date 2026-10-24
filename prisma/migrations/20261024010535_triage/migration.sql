-- CreateTable
CREATE TABLE "public"."TriageResponse" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "clientId" TEXT,
    "appointmentId" TEXT,
    "careTypeKey" TEXT NOT NULL,
    "careTypeName" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "outcome" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriageResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TriageResponse_appointmentId_key" ON "public"."TriageResponse"("appointmentId");

-- CreateIndex
CREATE INDEX "TriageResponse_orgId_clientId_idx" ON "public"."TriageResponse"("orgId", "clientId");

-- AddForeignKey
ALTER TABLE "public"."TriageResponse" ADD CONSTRAINT "TriageResponse_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TriageResponse" ADD CONSTRAINT "TriageResponse_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "public"."Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TriageResponse" ADD CONSTRAINT "TriageResponse_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TriageResponse" ADD CONSTRAINT "TriageResponse_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "public"."Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
