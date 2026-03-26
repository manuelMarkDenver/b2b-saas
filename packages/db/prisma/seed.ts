import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "Password123!";

type SeededUser = {
  email: string;
  passwordHash: string;
  isPlatformAdmin?: boolean;
};

async function upsertUser(user: SeededUser) {
  return prisma.user.upsert({
    where: { email: user.email },
    update: {
      passwordHash: user.passwordHash,
      isPlatformAdmin: user.isPlatformAdmin ?? false,
      status: "ACTIVE",
    },
    create: {
      email: user.email,
      passwordHash: user.passwordHash,
      isPlatformAdmin: user.isPlatformAdmin ?? false,
      status: "ACTIVE",
    },
  });
}

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

  const adminPasswordHash = await hash(adminPassword, 12);
  const defaultPasswordHash = await hash(DEFAULT_PASSWORD, 12);

  const admin = await upsertUser({
    email: adminEmail,
    passwordHash: adminPasswordHash,
    isPlatformAdmin: true,
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
      role: "OWNER",
    },
    create: {
      tenantId: tenant.id,
      userId: admin.id,
      status: "ACTIVE",
      isOwner: true,
      role: "OWNER",
    },
  });

  const tenantA = await prisma.tenant.upsert({
    where: { slug: "tenant-a" },
    update: { name: "Tenant A", createdByUserId: admin.id },
    create: { name: "Tenant A", slug: "tenant-a", createdByUserId: admin.id },
  });

  const tenantB = await prisma.tenant.upsert({
    where: { slug: "tenant-b" },
    update: { name: "Tenant B", createdByUserId: admin.id },
    create: { name: "Tenant B", slug: "tenant-b", createdByUserId: admin.id },
  });

  const users = {
    tenantAOwner: await upsertUser({
      email: "owner@tenant-a.test",
      passwordHash: defaultPasswordHash,
    }),
    tenantAAdmin: await upsertUser({
      email: "admin@tenant-a.test",
      passwordHash: defaultPasswordHash,
    }),
    tenantAMember: await upsertUser({
      email: "member@tenant-a.test",
      passwordHash: defaultPasswordHash,
    }),
    tenantAViewer: await upsertUser({
      email: "viewer@tenant-a.test",
      passwordHash: defaultPasswordHash,
    }),
    tenantBOwner: await upsertUser({
      email: "owner@tenant-b.test",
      passwordHash: defaultPasswordHash,
    }),
    tenantBAdmin: await upsertUser({
      email: "admin@tenant-b.test",
      passwordHash: defaultPasswordHash,
    }),
    tenantBMember: await upsertUser({
      email: "member@tenant-b.test",
      passwordHash: defaultPasswordHash,
    }),
    tenantBViewer: await upsertUser({
      email: "viewer@tenant-b.test",
      passwordHash: defaultPasswordHash,
    }),
    tenantAOnly: await upsertUser({
      email: "a-only@platform.test",
      passwordHash: defaultPasswordHash,
    }),
  };

  const memberships: Array<{
    tenantId: string;
    userId: string;
    role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
    isOwner?: boolean;
  }> = [
    { tenantId: tenantA.id, userId: users.tenantAOwner.id, role: "OWNER", isOwner: true },
    { tenantId: tenantA.id, userId: users.tenantAAdmin.id, role: "ADMIN" },
    { tenantId: tenantA.id, userId: users.tenantAMember.id, role: "MEMBER" },
    { tenantId: tenantA.id, userId: users.tenantAViewer.id, role: "VIEWER" },
    { tenantId: tenantB.id, userId: users.tenantBOwner.id, role: "OWNER", isOwner: true },
    { tenantId: tenantB.id, userId: users.tenantBAdmin.id, role: "ADMIN" },
    { tenantId: tenantB.id, userId: users.tenantBMember.id, role: "MEMBER" },
    { tenantId: tenantB.id, userId: users.tenantBViewer.id, role: "VIEWER" },
    { tenantId: tenantA.id, userId: users.tenantAOnly.id, role: "MEMBER" },
  ];

  for (const membership of memberships) {
    await prisma.tenantMembership.upsert({
      where: {
        tenantId_userId: {
          tenantId: membership.tenantId,
          userId: membership.userId,
        },
      },
      update: {
        status: "ACTIVE",
        isOwner: membership.isOwner ?? false,
        role: membership.role,
      },
      create: {
        tenantId: membership.tenantId,
        userId: membership.userId,
        status: "ACTIVE",
        isOwner: membership.isOwner ?? false,
        role: membership.role,
      },
    });
  }

  console.log("Seeded admin user:", admin.email);
  console.log("Seeded tenant:", tenant.slug);
  console.log("Seeded test tenants:", tenantA.slug, tenantB.slug);
  console.log("Seeded role users with password:", DEFAULT_PASSWORD);
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
