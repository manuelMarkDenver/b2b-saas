-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- AlterTable: add status to Tenant
ALTER TABLE "Tenant" ADD COLUMN "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable: add isArchived to Product
ALTER TABLE "Product" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: add isArchived to Sku
ALTER TABLE "Sku" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
