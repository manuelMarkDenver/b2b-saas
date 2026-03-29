-- Add password reset token fields to User
ALTER TABLE "User" ADD COLUMN "resetToken" TEXT;
ALTER TABLE "User" ADD COLUMN "resetTokenExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");

-- Add invite token fields to TenantMembership
ALTER TABLE "TenantMembership" ADD COLUMN "inviteToken" TEXT;
ALTER TABLE "TenantMembership" ADD COLUMN "inviteExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "TenantMembership_inviteToken_key" ON "TenantMembership"("inviteToken");

-- Add Notification model
CREATE TYPE "NotificationType" AS ENUM (
  'ORDER_CREATED',
  'ORDER_CONFIRMED',
  'ORDER_CANCELLED',
  'PAYMENT_SUBMITTED',
  'PAYMENT_VERIFIED',
  'PAYMENT_REJECTED',
  'LOW_STOCK',
  'STAFF_ADDED',
  'TENANT_SUSPENDED',
  'PLATFORM_ALERT'
);

CREATE TABLE "Notification" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"   UUID,
  "userId"     UUID NOT NULL,
  "type"       "NotificationType" NOT NULL,
  "title"      TEXT NOT NULL,
  "body"       TEXT NOT NULL,
  "entityType" TEXT,
  "entityId"   UUID,
  "isRead"     BOOLEAN NOT NULL DEFAULT false,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
CREATE INDEX "Notification_tenantId_idx" ON "Notification"("tenantId");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
