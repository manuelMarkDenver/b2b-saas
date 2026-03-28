-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('general_retail', 'hardware', 'food_beverage', 'packaging_supply');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "businessType" "BusinessType" NOT NULL DEFAULT 'general_retail',
ADD COLUMN     "features" JSONB NOT NULL DEFAULT '{"inventory":true,"orders":true,"payments":true,"marketplace":false}';
