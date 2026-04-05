/*
  Warnings:

  - Added the required column `poDate` to the `PurchaseOrder` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "expectedOn" TIMESTAMP(3),
ADD COLUMN     "poDate" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "PurchaseOrderItem" ADD COLUMN     "purchaseCostCents" INTEGER NOT NULL DEFAULT 0;
