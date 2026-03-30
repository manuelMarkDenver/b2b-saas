-- AlterTable
ALTER TABLE "Notification" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TenantMembership" ADD COLUMN     "jobTitle" TEXT;
