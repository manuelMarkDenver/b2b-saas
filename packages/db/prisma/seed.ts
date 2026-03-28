import { PrismaClient, MovementType, OrderStatus, PaymentStatus, ReferenceType } from "@prisma/client";
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

async function logMovement(
  tenantId: string,
  skuId: string,
  type: MovementType,
  quantity: number,
  referenceType: ReferenceType,
  noteOrReferenceId?: string,
  note?: string,
) {
  const delta =
    type === MovementType.IN
      ? quantity
      : type === MovementType.OUT
        ? -quantity
        : quantity;

  // When called from seedOrder, noteOrReferenceId is the orderId (referenceId)
  // When called directly for manual movements, noteOrReferenceId is the note
  const referenceId = referenceType === ReferenceType.ORDER ? noteOrReferenceId : undefined;
  const resolvedNote = referenceType === ReferenceType.ORDER ? note : noteOrReferenceId;

  await prisma.$transaction(async (tx) => {
    await tx.inventoryMovement.create({
      data: { tenantId, skuId, type, quantity, referenceType, referenceId: referenceId ?? null, note: resolvedNote ?? null },
    });
    await tx.sku.update({
      where: { id: skuId },
      data: { stockOnHand: { increment: delta } },
    });
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
    update: { value: "2" },
    create: { key: "schemaVersion", value: "2" },
  });

  const adminPasswordHash = await hash(adminPassword, 12);
  const defaultPasswordHash = await hash(DEFAULT_PASSWORD, 12);

  const admin = await upsertUser({
    email: adminEmail,
    passwordHash: adminPasswordHash,
    isPlatformAdmin: true,
  });

  const adminTenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: { name: tenantName, createdByUserId: admin.id },
    create: { name: tenantName, slug: tenantSlug, createdByUserId: admin.id },
  });

  await prisma.tenantMembership.upsert({
    where: { tenantId_userId: { tenantId: adminTenant.id, userId: admin.id } },
    update: { status: "ACTIVE", isOwner: true, role: "OWNER" },
    create: { tenantId: adminTenant.id, userId: admin.id, status: "ACTIVE", isOwner: true, role: "OWNER" },
  });

  // --- 3 Realistic Business Tenants ---

  const hardwareTenant = await prisma.tenant.upsert({
    where: { slug: "peak-hardware" },
    update: { name: "Peak Hardware Supply", createdByUserId: admin.id },
    create: { name: "Peak Hardware Supply", slug: "peak-hardware", createdByUserId: admin.id },
  });

  const foodTenant = await prisma.tenant.upsert({
    where: { slug: "metro-pizza-supply" },
    update: { name: "Metro Pizza Supply", createdByUserId: admin.id },
    create: { name: "Metro Pizza Supply", slug: "metro-pizza-supply", createdByUserId: admin.id },
  });

  const retailTenant = await prisma.tenant.upsert({
    where: { slug: "corner-general" },
    update: { name: "Corner General Store", createdByUserId: admin.id },
    create: { name: "Corner General Store", slug: "corner-general", createdByUserId: admin.id },
  });

  // --- Users ---

  const users = {
    hardwareOwner: await upsertUser({ email: "owner@peak-hardware.test", passwordHash: defaultPasswordHash }),
    hardwareMember: await upsertUser({ email: "staff@peak-hardware.test", passwordHash: defaultPasswordHash }),
    foodOwner: await upsertUser({ email: "owner@metro-pizza.test", passwordHash: defaultPasswordHash }),
    foodMember: await upsertUser({ email: "staff@metro-pizza.test", passwordHash: defaultPasswordHash }),
    retailOwner: await upsertUser({ email: "owner@corner-general.test", passwordHash: defaultPasswordHash }),
    retailMember: await upsertUser({ email: "staff@corner-general.test", passwordHash: defaultPasswordHash }),
  };

  const memberships: Array<{
    tenantId: string;
    userId: string;
    role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
    isOwner?: boolean;
  }> = [
    { tenantId: hardwareTenant.id, userId: users.hardwareOwner.id, role: "OWNER", isOwner: true },
    { tenantId: hardwareTenant.id, userId: users.hardwareMember.id, role: "MEMBER" },
    { tenantId: foodTenant.id, userId: users.foodOwner.id, role: "OWNER", isOwner: true },
    { tenantId: foodTenant.id, userId: users.foodMember.id, role: "MEMBER" },
    { tenantId: retailTenant.id, userId: users.retailOwner.id, role: "OWNER", isOwner: true },
    { tenantId: retailTenant.id, userId: users.retailMember.id, role: "MEMBER" },
  ];

  for (const m of memberships) {
    await prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId: m.tenantId, userId: m.userId } },
      update: { status: "ACTIVE", isOwner: m.isOwner ?? false, role: m.role },
      create: { tenantId: m.tenantId, userId: m.userId, status: "ACTIVE", isOwner: m.isOwner ?? false, role: m.role },
    });
  }

  // --- Categories ---

  const categoryData = [
    { name: "Fasteners", slug: "fasteners" },
    { name: "Electrical", slug: "electrical" },
    { name: "Safety Equipment", slug: "safety-equipment" },
    { name: "Flour & Grains", slug: "flour-grains" },
    { name: "Dairy & Cheese", slug: "dairy-cheese" },
    { name: "Sauces & Condiments", slug: "sauces-condiments" },
    { name: "Beverages", slug: "beverages" },
    { name: "Snacks", slug: "snacks" },
    { name: "Cleaning Supplies", slug: "cleaning-supplies" },
  ];

  for (const c of categoryData) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: { name: c.name, slug: c.slug },
    });
  }

  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const cat = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

  // --- Helper: upsert product + SKU (stockOnHand starts at 0) ---

  async function upsertProductSku(opts: {
    tenantId: string;
    categoryId: string;
    productName: string;
    skuCode: string;
    skuName: string;
    priceCents: number;
    costCents: number;
    lowStockThreshold: number;
  }) {
    const existing = await prisma.product.findFirst({
      where: { tenantId: opts.tenantId, name: opts.productName },
      select: { id: true },
    });

    const product = existing
      ? await prisma.product.update({
          where: { id: existing.id },
          data: { categoryId: opts.categoryId, isActive: true },
        })
      : await prisma.product.create({
          data: {
            tenantId: opts.tenantId,
            categoryId: opts.categoryId,
            name: opts.productName,
            isActive: true,
          },
        });

    const sku = await prisma.sku.upsert({
      where: { tenantId_code: { tenantId: opts.tenantId, code: opts.skuCode } },
      update: {
        productId: product.id,
        name: opts.skuName,
        priceCents: opts.priceCents,
        costCents: opts.costCents,
        lowStockThreshold: opts.lowStockThreshold,
        isActive: true,
      },
      create: {
        tenantId: opts.tenantId,
        productId: product.id,
        code: opts.skuCode,
        name: opts.skuName,
        priceCents: opts.priceCents,
        costCents: opts.costCents,
        stockOnHand: 0,
        lowStockThreshold: opts.lowStockThreshold,
        isActive: true,
      },
    });

    return sku;
  }

  // --- Peak Hardware Supply ---

  const boltSku = await upsertProductSku({
    tenantId: hardwareTenant.id,
    categoryId: cat["fasteners"],
    productName: "Hex Bolt M8",
    skuCode: "PHW-BOLT-M8",
    skuName: "Hex Bolt M8 x 25mm",
    priceCents: 150,
    costCents: 60,
    lowStockThreshold: 50,
  });

  const washerSku = await upsertProductSku({
    tenantId: hardwareTenant.id,
    categoryId: cat["fasteners"],
    productName: "Flat Washer M8",
    skuCode: "PHW-WASH-M8",
    skuName: "Flat Washer M8",
    priceCents: 50,
    costCents: 15,
    lowStockThreshold: 100,
  });

  const cableSku = await upsertProductSku({
    tenantId: hardwareTenant.id,
    categoryId: cat["electrical"],
    productName: "Electrical Cable 2.5mm",
    skuCode: "PHW-CABLE-25",
    skuName: "Electrical Cable 2.5mm (per meter)",
    priceCents: 8500,
    costCents: 5200,
    lowStockThreshold: 20,
  });

  // Peak Hardware — initial stock IN movements
  if (boltSku.stockOnHand === 0) {
    await logMovement(hardwareTenant.id, boltSku.id, MovementType.IN, 200, ReferenceType.MANUAL, "Initial stock");
  }
  if (washerSku.stockOnHand === 0) {
    await logMovement(hardwareTenant.id, washerSku.id, MovementType.IN, 500, ReferenceType.MANUAL, "Initial stock");
  }
  if (cableSku.stockOnHand === 0) {
    await logMovement(hardwareTenant.id, cableSku.id, MovementType.IN, 100, ReferenceType.MANUAL, "Initial stock");
    await logMovement(hardwareTenant.id, cableSku.id, MovementType.OUT, 15, ReferenceType.MANUAL, "Sold to contractor");
  }

  // --- Metro Pizza Supply ---

  const flourSku = await upsertProductSku({
    tenantId: foodTenant.id,
    categoryId: cat["flour-grains"],
    productName: "All-Purpose Flour",
    skuCode: "MPS-FLOUR-25K",
    skuName: "All-Purpose Flour 25kg Sack",
    priceCents: 189000,
    costCents: 120000,
    lowStockThreshold: 5,
  });

  const mozzaSku = await upsertProductSku({
    tenantId: foodTenant.id,
    categoryId: cat["dairy-cheese"],
    productName: "Mozzarella Block",
    skuCode: "MPS-MOZZ-2K",
    skuName: "Mozzarella Block 2kg",
    priceCents: 145000,
    costCents: 95000,
    lowStockThreshold: 10,
  });

  const sauceSku = await upsertProductSku({
    tenantId: foodTenant.id,
    categoryId: cat["sauces-condiments"],
    productName: "Pizza Sauce",
    skuCode: "MPS-SAUCE-3K",
    skuName: "Pizza Sauce 3kg Can",
    priceCents: 62000,
    costCents: 38000,
    lowStockThreshold: 8,
  });

  // Metro Pizza — initial stock IN movements
  if (flourSku.stockOnHand === 0) {
    await logMovement(foodTenant.id, flourSku.id, MovementType.IN, 40, ReferenceType.MANUAL, "Initial stock");
    await logMovement(foodTenant.id, flourSku.id, MovementType.OUT, 8, ReferenceType.MANUAL, "Delivered to client");
  }
  if (mozzaSku.stockOnHand === 0) {
    await logMovement(foodTenant.id, mozzaSku.id, MovementType.IN, 30, ReferenceType.MANUAL, "Initial stock");
  }
  if (sauceSku.stockOnHand === 0) {
    await logMovement(foodTenant.id, sauceSku.id, MovementType.IN, 24, ReferenceType.MANUAL, "Initial stock");
    await logMovement(foodTenant.id, sauceSku.id, MovementType.OUT, 6, ReferenceType.MANUAL, "Sold to restaurant");
  }

  // --- Corner General Store ---

  const colaSku = await upsertProductSku({
    tenantId: retailTenant.id,
    categoryId: cat["beverages"],
    productName: "Cola 355ml Can",
    skuCode: "CGS-COLA-355",
    skuName: "Cola 355ml Can",
    priceCents: 6500,
    costCents: 3800,
    lowStockThreshold: 24,
  });

  const chipsSku = await upsertProductSku({
    tenantId: retailTenant.id,
    categoryId: cat["snacks"],
    productName: "Potato Chips Original",
    skuCode: "CGS-CHIPS-OR",
    skuName: "Potato Chips Original 150g",
    priceCents: 9900,
    costCents: 5500,
    lowStockThreshold: 12,
  });

  const cleanerSku = await upsertProductSku({
    tenantId: retailTenant.id,
    categoryId: cat["cleaning-supplies"],
    productName: "All-Purpose Cleaner",
    skuCode: "CGS-CLEAN-1L",
    skuName: "All-Purpose Cleaner 1L",
    priceCents: 28500,
    costCents: 16000,
    lowStockThreshold: 6,
  });

  // Corner General — initial stock IN movements
  if (colaSku.stockOnHand === 0) {
    await logMovement(retailTenant.id, colaSku.id, MovementType.IN, 144, ReferenceType.MANUAL, "Initial stock");
    await logMovement(retailTenant.id, colaSku.id, MovementType.OUT, 36, ReferenceType.MANUAL, "Daily sales");
  }
  if (chipsSku.stockOnHand === 0) {
    await logMovement(retailTenant.id, chipsSku.id, MovementType.IN, 60, ReferenceType.MANUAL, "Initial stock");
    await logMovement(retailTenant.id, chipsSku.id, MovementType.ADJUSTMENT, -3, ReferenceType.MANUAL, "Damaged stock written off");
  }
  if (cleanerSku.stockOnHand === 0) {
    await logMovement(retailTenant.id, cleanerSku.id, MovementType.IN, 24, ReferenceType.MANUAL, "Initial stock");
  }

  // --- Helper: create order with items ---

  async function seedOrder(opts: {
    tenantId: string;
    items: Array<{ skuId: string; quantity: number; priceCents: number }>;
    status: OrderStatus;
  }) {
    const existing = await prisma.order.count({ where: { tenantId: opts.tenantId, status: opts.status } });
    if (existing > 0) return; // idempotent — skip if orders already exist for this tenant+status

    const totalCents = opts.items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);

    const order = await prisma.order.create({
      data: {
        tenantId: opts.tenantId,
        status: opts.status,
        totalCents,
        items: {
          create: opts.items.map((i) => ({
            skuId: i.skuId,
            quantity: i.quantity,
            priceAtTime: i.priceCents,
          })),
        },
      },
    });

    // If CONFIRMED, log OUT movements
    if (opts.status === OrderStatus.CONFIRMED) {
      for (const item of opts.items) {
        await logMovement(opts.tenantId, item.skuId, MovementType.OUT, item.quantity, ReferenceType.ORDER, order.id);
      }
    }
  }

  // --- Seed Orders ---

  // Peak Hardware: one PENDING, one CONFIRMED
  await seedOrder({
    tenantId: hardwareTenant.id,
    items: [
      { skuId: boltSku.id, quantity: 50, priceCents: boltSku.priceCents ?? 150 },
      { skuId: washerSku.id, quantity: 100, priceCents: washerSku.priceCents ?? 50 },
    ],
    status: OrderStatus.PENDING,
  });
  await seedOrder({
    tenantId: hardwareTenant.id,
    items: [{ skuId: cableSku.id, quantity: 10, priceCents: cableSku.priceCents ?? 8500 }],
    status: OrderStatus.CONFIRMED,
  });

  // Metro Pizza: one PENDING, one COMPLETED
  await seedOrder({
    tenantId: foodTenant.id,
    items: [
      { skuId: flourSku.id, quantity: 5, priceCents: flourSku.priceCents ?? 189000 },
      { skuId: sauceSku.id, quantity: 6, priceCents: sauceSku.priceCents ?? 62000 },
    ],
    status: OrderStatus.PENDING,
  });
  await seedOrder({
    tenantId: foodTenant.id,
    items: [{ skuId: mozzaSku.id, quantity: 8, priceCents: mozzaSku.priceCents ?? 145000 }],
    status: OrderStatus.COMPLETED,
  });

  // Corner General: one PENDING, one CANCELLED
  await seedOrder({
    tenantId: retailTenant.id,
    items: [
      { skuId: colaSku.id, quantity: 24, priceCents: colaSku.priceCents ?? 6500 },
      { skuId: chipsSku.id, quantity: 12, priceCents: chipsSku.priceCents ?? 9900 },
    ],
    status: OrderStatus.PENDING,
  });
  await seedOrder({
    tenantId: retailTenant.id,
    items: [{ skuId: cleanerSku.id, quantity: 6, priceCents: cleanerSku.priceCents ?? 28500 }],
    status: OrderStatus.CANCELLED,
  });

  // --- Seed Payments ---

  async function seedPayment(opts: {
    tenantId: string;
    orderId: string;
    amountCents: number;
    status: PaymentStatus;
    proofUrl?: string;
  }) {
    const existing = await prisma.payment.count({ where: { orderId: opts.orderId } });
    if (existing > 0) return;

    await prisma.payment.create({
      data: {
        tenantId: opts.tenantId,
        orderId: opts.orderId,
        amountCents: opts.amountCents,
        status: opts.status,
        proofUrl: opts.proofUrl ?? null,
      },
    });
  }

  // Get seeded orders to attach payments to
  const hwConfirmed = await prisma.order.findFirst({
    where: { tenantId: hardwareTenant.id, status: OrderStatus.CONFIRMED },
  });
  const foodCompleted = await prisma.order.findFirst({
    where: { tenantId: foodTenant.id, status: OrderStatus.COMPLETED },
  });
  const retailPending = await prisma.order.findFirst({
    where: { tenantId: retailTenant.id, status: OrderStatus.PENDING },
  });

  if (hwConfirmed) {
    await seedPayment({
      tenantId: hardwareTenant.id,
      orderId: hwConfirmed.id,
      amountCents: hwConfirmed.totalCents,
      status: PaymentStatus.VERIFIED,
      proofUrl: "https://example.com/receipts/peak-hw-001.jpg",
    });
  }

  if (foodCompleted) {
    await seedPayment({
      tenantId: foodTenant.id,
      orderId: foodCompleted.id,
      amountCents: foodCompleted.totalCents,
      status: PaymentStatus.VERIFIED,
      proofUrl: "https://example.com/receipts/metro-pizza-001.jpg",
    });
  }

  if (retailPending) {
    await seedPayment({
      tenantId: retailTenant.id,
      orderId: retailPending.id,
      amountCents: retailPending.totalCents,
      status: PaymentStatus.PENDING,
    });
  }

  console.log("✓ Admin:", admin.email);
  console.log("✓ Tenants:", hardwareTenant.slug, "|", foodTenant.slug, "|", retailTenant.slug);
  console.log("✓ Categories:", categoryData.map((c) => c.slug).join(", "));
  console.log("✓ Default password:", DEFAULT_PASSWORD);
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
