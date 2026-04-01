-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'GCASH', 'MAYA', 'BANK_TRANSFER', 'CARD', 'CHEQUE');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "method" "PaymentMethod" NOT NULL DEFAULT 'CASH';

-- CreateIndex
CREATE INDEX "Payment_method_idx" ON "Payment"("method");
