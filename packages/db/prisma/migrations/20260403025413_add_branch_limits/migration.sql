-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxBranches" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "features" SET DEFAULT '{"inventory":true,"orders":true,"payments":true,"marketplace":false,"stockTransfers":false,"paymentTerms":false,"multipleBranches":false}';
