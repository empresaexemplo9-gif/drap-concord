-- CreateTable
CREATE TABLE "public"."CallRoom" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "ownerId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "CallRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CallParticipant" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'INVITED',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "CallParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RealtimeEvent" (
    "id" BIGSERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RealtimeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallRoom_ownerId_createdAt_idx" ON "public"."CallRoom"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "CallParticipant_userId_state_idx" ON "public"."CallParticipant"("userId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "CallParticipant_roomId_userId_key" ON "public"."CallParticipant"("roomId", "userId");

-- CreateIndex
CREATE INDEX "RealtimeEvent_userId_id_idx" ON "public"."RealtimeEvent"("userId", "id");

-- CreateIndex
CREATE INDEX "RealtimeEvent_createdAt_idx" ON "public"."RealtimeEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."CallRoom" ADD CONSTRAINT "CallRoom_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CallRoom" ADD CONSTRAINT "CallRoom_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "public"."Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CallParticipant" ADD CONSTRAINT "CallParticipant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."CallRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CallParticipant" ADD CONSTRAINT "CallParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RealtimeEvent" ADD CONSTRAINT "RealtimeEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
