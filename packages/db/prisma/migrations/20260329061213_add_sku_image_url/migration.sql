-- AlterTable
ALTER TABLE "Notification" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Sku" ADD COLUMN     "imageUrl" TEXT;
