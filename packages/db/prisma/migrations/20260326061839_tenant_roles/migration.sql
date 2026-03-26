-- CreateEnum
CREATE TYPE "TenantRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- AlterTable
ALTER TABLE "TenantMembership" ADD COLUMN     "role" "TenantRole" NOT NULL DEFAULT 'MEMBER';
