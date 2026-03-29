-- Rename TenantRole enum value MEMBER to STAFF
-- This is a non-destructive rename — existing rows with role='MEMBER' are updated in place

ALTER TYPE "TenantRole" RENAME VALUE 'MEMBER' TO 'STAFF';
