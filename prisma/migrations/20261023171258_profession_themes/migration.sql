-- AlterTable
ALTER TABLE "public"."ProfessionProfile" ADD COLUMN     "themeId" TEXT;

-- CreateTable
CREATE TABLE "public"."ProfessionTheme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "palette" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionTheme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionTheme_name_key" ON "public"."ProfessionTheme"("name");

-- AddForeignKey
ALTER TABLE "public"."ProfessionProfile" ADD CONSTRAINT "ProfessionProfile_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "public"."ProfessionTheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;
