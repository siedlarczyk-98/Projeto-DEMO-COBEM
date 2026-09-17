-- CreateEnum
CREATE TYPE "RdStatus" AS ENUM ('PENDENTE', 'ENVIADO', 'FALHOU', 'DESATIVADO');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "rdStatus" "RdStatus" NOT NULL DEFAULT 'PENDENTE',
ADD COLUMN     "rdSyncedAt" TIMESTAMP(3),
ADD COLUMN     "rdEventUuid" TEXT,
ADD COLUMN     "rdError" TEXT,
ADD COLUMN     "rdAttempts" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Lead_rdStatus_idx" ON "Lead"("rdStatus");
