-- Add username field to TenantMembership for direct-add staff (scoped per tenant)
ALTER TABLE "TenantMembership" ADD COLUMN "username" TEXT;
CREATE UNIQUE INDEX "TenantMembership_tenantId_username_key" ON "TenantMembership"("tenantId", "username");

-- Add customerRef and note to Order for B2B identification
ALTER TABLE "Order" ADD COLUMN "customerRef" TEXT;
ALTER TABLE "Order" ADD COLUMN "note" TEXT;
