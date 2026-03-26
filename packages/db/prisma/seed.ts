import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail =
    process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "admin@local.test";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";
  const tenantName = process.env.ADMIN_TENANT_NAME ?? "Admin Tenant";
  const tenantSlug =
    process.env.ADMIN_TENANT_SLUG?.trim().toLowerCase() ?? "admin";

  await prisma.appMeta.upsert({
    where: { key: "schemaVersion" },
    update: { value: "1" },
    create: { key: "schemaVersion", value: "1" },
  });

  const passwordHash = await hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      isPlatformAdmin: true,
      status: "ACTIVE",
    },
    create: {
      email: adminEmail,
      passwordHash,
      isPlatformAdmin: true,
      status: "ACTIVE",
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: {
      name: tenantName,
      createdByUserId: admin.id,
    },
    create: {
      name: tenantName,
      slug: tenantSlug,
      createdByUserId: admin.id,
    },
  });

  await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: admin.id,
      },
    },
    update: {
      status: "ACTIVE",
      isOwner: true,
    },
    create: {
      tenantId: tenant.id,
      userId: admin.id,
      status: "ACTIVE",
      isOwner: true,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
