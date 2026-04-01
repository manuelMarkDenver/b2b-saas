-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN     "actorId" UUID,
ADD COLUMN     "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "reason" TEXT;

-- CreateIndex
CREATE INDEX "InventoryMovement_approvalStatus_idx" ON "InventoryMovement"("approvalStatus");

-- CreateIndex
CREATE INDEX "InventoryMovement_actorId_idx" ON "InventoryMovement"("actorId");

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
