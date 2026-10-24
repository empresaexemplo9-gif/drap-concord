-- AlterTable
ALTER TABLE "public"."Professional" ADD COLUMN     "brand" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "public"."BrandAsset" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mime" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "palette" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandAsset_professionalId_kind_key" ON "public"."BrandAsset"("professionalId", "kind");

-- AddForeignKey
ALTER TABLE "public"."BrandAsset" ADD CONSTRAINT "BrandAsset_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "public"."Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;
