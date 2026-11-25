-- AlterEnum
ALTER TYPE "RdStatus" ADD VALUE 'VIA_RD';

-- CreateEnum
CREATE TYPE "OrigemLead" AS ENUM ('LP', 'RD_LP');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "origem" "OrigemLead" NOT NULL DEFAULT 'LP',
ADD COLUMN "perfilInformado" TEXT;
