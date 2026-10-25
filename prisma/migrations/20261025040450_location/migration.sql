-- AlterTable
ALTER TABLE "public"."Professional" ADD COLUMN     "address" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "serviceRadiusKm" INTEGER;

-- O endereço que estava nos contatos da marca passa a ser o local de atendimento.
UPDATE "Professional" SET "address" = "brand"->'contacts'->>'address' WHERE "address" IS NULL AND "brand"->'contacts'->>'address' IS NOT NULL;
