-- AlterEnum
ALTER TYPE "Perfil" ADD VALUE 'COORDENADOR';
ALTER TYPE "Perfil" ADD VALUE 'REITORIA';

-- AlterTable
-- Default temporario para preencher os leads ja existentes; removido em seguida
-- para que novos registros sejam obrigados a informar a IES.
ALTER TABLE "Lead" ADD COLUMN "ies" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Lead" ALTER COLUMN "ies" DROP DEFAULT;
