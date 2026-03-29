-- Add avatarUrl to User
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;

-- Add logoUrl to Tenant
ALTER TABLE "Tenant" ADD COLUMN "logoUrl" TEXT;
