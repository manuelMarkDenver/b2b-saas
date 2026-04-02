import { PrismaClient, MovementType, OrderStatus, PaymentMethod, PaymentStatus, ReferenceType, BranchType, ContactType } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomUUID } from "crypto";

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

/** Apply an inventory movement and update stockOnHand in one transaction. */
async function logMovement(
  tenantId: string,
  skuId: string,
  type: MovementType,
  quantity: number,
  referenceType: ReferenceType,
  noteOrReferenceId?: string,
  note?: string,
  branchId?: string,
) {
  const delta =
    type === MovementType.IN
      ? quantity
      : type === MovementType.OUT
        ? -quantity
        : quantity;

  const referenceId = referenceType === ReferenceType.ORDER ? noteOrReferenceId : undefined;
  const resolvedNote = referenceType === ReferenceType.ORDER ? note : noteOrReferenceId;

  await prisma.$transaction(async (tx) => {
    await tx.inventoryMovement.create({
      data: { tenantId, skuId, type, quantity, referenceType, referenceId: referenceId ?? null, note: resolvedNote ?? null, branchId: branchId ?? null },
    });
    await tx.sku.update({
      where: { id: skuId },
      data: { stockOnHand: { increment: delta } },
    });
  });
}

async function upsertProductSku(opts: {
  tenantId: string;
  categoryId: string;
  productName: string;
  skuCode: string;
  skuName: string;
  priceCents: number;
  costCents: number;
  lowStockThreshold: number;
  isArchived?: boolean;
}) {
  const existing = await prisma.product.findFirst({
    where: { tenantId: opts.tenantId, name: opts.productName },
    select: { id: true },
  });

  const product = existing
    ? await prisma.product.update({
        where: { id: existing.id },
        data: { categoryId: opts.categoryId, isActive: !opts.isArchived, isArchived: opts.isArchived ?? false },
      })
    : await prisma.product.create({
        data: {
          tenantId: opts.tenantId,
          categoryId: opts.categoryId,
          name: opts.productName,
          isActive: !opts.isArchived,
          isArchived: opts.isArchived ?? false,
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
      isActive: !opts.isArchived,
      isArchived: opts.isArchived ?? false,
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
      isActive: !opts.isArchived,
      isArchived: opts.isArchived ?? false,
    },
  });

  return sku;
}

/** Create a single order with items; optionally deduct stock for CONFIRMED. */
async function createOrder(opts: {
  tenantId: string;
  items: Array<{ skuId: string; quantity: number; priceCents: number }>;
  status: OrderStatus;
  deductStock?: boolean;
  branchId?: string;
  customerRef?: string;
}) {
  const totalCents = opts.items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);

  const order = await prisma.order.create({
    data: {
      tenantId: opts.tenantId,
      status: opts.status,
      totalCents,
      branchId: opts.branchId ?? null,
      customerRef: opts.customerRef ?? null,
      items: {
        create: opts.items.map((i) => ({
          skuId: i.skuId,
          quantity: i.quantity,
          priceAtTime: i.priceCents,
        })),
      },
    },
  });

  if (opts.deductStock) {
    for (const item of opts.items) {
      await logMovement(opts.tenantId, item.skuId, MovementType.OUT, item.quantity, ReferenceType.ORDER, order.id, undefined, opts.branchId);
    }
  }

  return order;
}

// Realistic PH payment method rotation for seed data
const PH_METHODS: PaymentMethod[] = [
  PaymentMethod.GCASH,
  PaymentMethod.MAYA,
  PaymentMethod.BANK_TRANSFER,
  PaymentMethod.CASH,
  PaymentMethod.CARD,
];
let _methodIdx = 0;
function nextMethod(): PaymentMethod {
  return PH_METHODS[_methodIdx++ % PH_METHODS.length];
}

/** Create a payment for an order if none exists yet. */
async function createPaymentIfAbsent(opts: {
  tenantId: string;
  orderId: string;
  amountCents: number;
  status: PaymentStatus;
  proofUrl?: string;
  method?: PaymentMethod;
}) {
  const existing = await prisma.payment.count({ where: { orderId: opts.orderId } });
  if (existing > 0) return;
  await prisma.payment.create({
    data: {
      tenantId: opts.tenantId,
      orderId: opts.orderId,
      amountCents: opts.amountCents,
      status: opts.status,
      method: opts.method ?? nextMethod(),
      proofUrl: opts.proofUrl ?? null,
    },
  });
}

async function upsertContact(tenantId: string, name: string, opts: {
  type: ContactType;
  phone?: string;
  address?: string;
  creditLimitCents?: number;
}) {
  const existing = await prisma.contact.findFirst({ where: { tenantId, name }, select: { id: true } });
  if (existing) return existing;
  return prisma.contact.create({
    data: {
      tenantId,
      name,
      type: opts.type,
      phone: opts.phone ?? null,
      address: opts.address ?? null,
      creditLimitCents: opts.creditLimitCents ?? 0,
      isActive: true,
    },
  });
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "admin@local.test";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";
  const tenantName = process.env.ADMIN_TENANT_NAME ?? "Admin Tenant";
  const tenantSlug = process.env.ADMIN_TENANT_SLUG?.trim().toLowerCase() ?? "admin";

  await prisma.appMeta.upsert({
    where: { key: "schemaVersion" },
    update: { value: "2" },
    create: { key: "schemaVersion", value: "2" },
  });

  const adminPasswordHash = await hash(adminPassword, 12);
  const defaultPasswordHash = await hash(DEFAULT_PASSWORD, 12);

  const admin = await upsertUser({ email: adminEmail, passwordHash: adminPasswordHash, isPlatformAdmin: true });

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

  const defaultFeatures = { inventory: true, orders: true, payments: true, team: true, catalog: true, reports: true, marketplace: false, stockTransfers: false, paymentTerms: false };

  const hardwareTenant = await prisma.tenant.upsert({
    where: { slug: "peak-hardware" },
    update: { name: "Peak Hardware Supply", createdByUserId: admin.id, businessType: "hardware", features: defaultFeatures },
    create: { name: "Peak Hardware Supply", slug: "peak-hardware", createdByUserId: admin.id, businessType: "hardware", features: defaultFeatures },
  });

  const foodTenant = await prisma.tenant.upsert({
    where: { slug: "metro-pizza-supply" },
    update: { name: "Metro Pizza Supply", createdByUserId: admin.id, businessType: "food_beverage", features: defaultFeatures },
    create: { name: "Metro Pizza Supply", slug: "metro-pizza-supply", createdByUserId: admin.id, businessType: "food_beverage", features: defaultFeatures },
  });

  const retailTenant = await prisma.tenant.upsert({
    where: { slug: "corner-general" },
    update: { name: "Corner General Store", createdByUserId: admin.id, businessType: "general_retail", features: defaultFeatures },
    create: { name: "Corner General Store", slug: "corner-general", createdByUserId: admin.id, businessType: "general_retail", features: defaultFeatures },
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
    role: "OWNER" | "ADMIN" | "STAFF" | "VIEWER";
    isOwner?: boolean;
  }> = [
    { tenantId: hardwareTenant.id, userId: users.hardwareOwner.id, role: "OWNER", isOwner: true },
    { tenantId: hardwareTenant.id, userId: users.hardwareMember.id, role: "STAFF" },
    { tenantId: foodTenant.id, userId: users.foodOwner.id, role: "OWNER", isOwner: true },
    { tenantId: foodTenant.id, userId: users.foodMember.id, role: "STAFF" },
    { tenantId: retailTenant.id, userId: users.retailOwner.id, role: "OWNER", isOwner: true },
    { tenantId: retailTenant.id, userId: users.retailMember.id, role: "STAFF" },
  ];

  for (const m of memberships) {
    await prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId: m.tenantId, userId: m.userId } },
      update: { status: "ACTIVE", isOwner: m.isOwner ?? false, role: m.role },
      create: { tenantId: m.tenantId, userId: m.userId, status: "ACTIVE", isOwner: m.isOwner ?? false, role: m.role },
    });
  }

  // --- Branches ---

  async function upsertBranch(tenantId: string, name: string, isDefault: boolean, type: BranchType = BranchType.STANDARD) {
    const existing = await prisma.branch.findFirst({ where: { tenantId, name }, select: { id: true } });
    if (existing) {
      await prisma.branch.update({ where: { id: existing.id }, data: { type, isDefault } });
      return existing;
    }
    return prisma.branch.create({ data: { tenantId, name, isDefault, type, status: "ACTIVE" } });
  }

  const hwMainBranch    = await upsertBranch(hardwareTenant.id, "Main Warehouse",   true,  BranchType.WAREHOUSE);
  const hwRetailBranch  = await upsertBranch(hardwareTenant.id, "Retail Counter",   false, BranchType.RETAIL);
  const mpsCentralBranch  = await upsertBranch(foodTenant.id,   "Central Kitchen",  true,  BranchType.PRODUCTION);
  const mpsKatiBranch     = await upsertBranch(foodTenant.id,   "Katipunan Outlet", false, BranchType.RETAIL);
  const cgsMainBranch   = await upsertBranch(retailTenant.id,   "Main Store",       true,  BranchType.STANDARD);
  const cgsAnnexBranch  = await upsertBranch(retailTenant.id,   "Annex Branch",     false, BranchType.RETAIL);

  // --- Categories ---

  const categoryData = [
    { name: "Fasteners", slug: "fasteners" },
    { name: "Electrical", slug: "electrical" },
    { name: "Safety Equipment", slug: "safety-equipment" },
    { name: "Tools", slug: "tools" },
    { name: "Flour & Grains", slug: "flour-grains" },
    { name: "Dairy & Cheese", slug: "dairy-cheese" },
    { name: "Sauces & Condiments", slug: "sauces-condiments" },
    { name: "Dry Goods", slug: "dry-goods" },
    { name: "Beverages", slug: "beverages" },
    { name: "Snacks", slug: "snacks" },
    { name: "Cleaning Supplies", slug: "cleaning-supplies" },
    { name: "Personal Care", slug: "personal-care" },
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

  // ===========================
  // PEAK HARDWARE SUPPLY
  // ===========================

  const boltSku = await upsertProductSku({
    tenantId: hardwareTenant.id, categoryId: cat["fasteners"],
    productName: "Hex Bolt M8", skuCode: "PHW-BOLT-M8",
    skuName: "Hex Bolt M8 × 25mm", priceCents: 150, costCents: 60, lowStockThreshold: 50,
  });
  const washerSku = await upsertProductSku({
    tenantId: hardwareTenant.id, categoryId: cat["fasteners"],
    productName: "Flat Washer M8", skuCode: "PHW-WASH-M8",
    skuName: "Flat Washer M8", priceCents: 50, costCents: 15, lowStockThreshold: 100,
  });
  const nutSku = await upsertProductSku({
    tenantId: hardwareTenant.id, categoryId: cat["fasteners"],
    productName: "Hex Nut M8", skuCode: "PHW-NUT-M8",
    skuName: "Hex Nut M8", priceCents: 45, costCents: 12, lowStockThreshold: 100,
  });
  const cableSku = await upsertProductSku({
    tenantId: hardwareTenant.id, categoryId: cat["electrical"],
    productName: "Electrical Cable 2.5mm", skuCode: "PHW-CABLE-25",
    skuName: "Electrical Cable 2.5mm (per meter)", priceCents: 8500, costCents: 5200, lowStockThreshold: 20,
  });
  const extCordSku = await upsertProductSku({
    tenantId: hardwareTenant.id, categoryId: cat["electrical"],
    productName: "Extension Cord 5m", skuCode: "PHW-EXT-5M",
    skuName: "Extension Cord 5m 3-outlet", priceCents: 45000, costCents: 28000, lowStockThreshold: 5,
  });
  const glovesSku = await upsertProductSku({
    tenantId: hardwareTenant.id, categoryId: cat["safety-equipment"],
    productName: "Safety Gloves", skuCode: "PHW-GLOVE-L",
    skuName: "Safety Gloves Large (pair)", priceCents: 18500, costCents: 10000, lowStockThreshold: 10,
  });
  const hardhatSku = await upsertProductSku({
    tenantId: hardwareTenant.id, categoryId: cat["safety-equipment"],
    productName: "Hard Hat", skuCode: "PHW-HHAT-YLW",
    skuName: "Hard Hat Yellow", priceCents: 95000, costCents: 55000, lowStockThreshold: 5,
  });
  // Archived SKU — discontinued item
  await upsertProductSku({
    tenantId: hardwareTenant.id, categoryId: cat["tools"],
    productName: "Manual Hand Drill (Discontinued)", skuCode: "PHW-DRILL-MAN",
    skuName: "Manual Hand Drill", priceCents: 350000, costCents: 200000, lowStockThreshold: 2,
    isArchived: true,
  });

  // Stock for Peak Hardware — each SKU has its own idempotency check
  const hwMain = hwMainBranch.id;

  const hwBoltStock = await prisma.sku.findUnique({ where: { id: boltSku.id }, select: { stockOnHand: true } });
  if ((hwBoltStock?.stockOnHand ?? 0) < 100) {
    await logMovement(hardwareTenant.id, boltSku.id,    MovementType.IN,  2000, ReferenceType.MANUAL, "Initial stock",               undefined, hwMain);
    await logMovement(hardwareTenant.id, boltSku.id,    MovementType.ADJUSTMENT, -50, ReferenceType.MANUAL, "Inventory count correction", undefined, hwMain);
  }

  const hwWasherStock = await prisma.sku.findUnique({ where: { id: washerSku.id }, select: { stockOnHand: true } });
  if ((hwWasherStock?.stockOnHand ?? 0) < 100) {
    await logMovement(hardwareTenant.id, washerSku.id,  MovementType.IN,  3000, ReferenceType.MANUAL, "Initial stock",               undefined, hwMain);
  }

  const hwNutStock = await prisma.sku.findUnique({ where: { id: nutSku.id }, select: { stockOnHand: true } });
  if ((hwNutStock?.stockOnHand ?? 0) < 100) {
    await logMovement(hardwareTenant.id, nutSku.id,     MovementType.IN,  3000, ReferenceType.MANUAL, "Initial stock",               undefined, hwMain);
  }

  const hwCableStock = await prisma.sku.findUnique({ where: { id: cableSku.id }, select: { stockOnHand: true } });
  if ((hwCableStock?.stockOnHand ?? 0) < 50) {
    await logMovement(hardwareTenant.id, cableSku.id,   MovementType.IN,   500, ReferenceType.MANUAL, "Initial stock",               undefined, hwMain);
    await logMovement(hardwareTenant.id, cableSku.id,   MovementType.OUT,   15, ReferenceType.MANUAL, "Sold to contractor",            undefined, hwMain);
  }

  const hwExtCordStock = await prisma.sku.findUnique({ where: { id: extCordSku.id }, select: { stockOnHand: true } });
  if ((hwExtCordStock?.stockOnHand ?? 0) < 10) {
    await logMovement(hardwareTenant.id, extCordSku.id, MovementType.IN,    80, ReferenceType.MANUAL, "Initial stock",               undefined, hwMain);
  }

  const hwGlovesStock = await prisma.sku.findUnique({ where: { id: glovesSku.id }, select: { stockOnHand: true } });
  if ((hwGlovesStock?.stockOnHand ?? 0) < 10) {
    await logMovement(hardwareTenant.id, glovesSku.id,  MovementType.IN,   120, ReferenceType.MANUAL, "Initial stock",               undefined, hwMain);
  }

  const hwHardhatStock = await prisma.sku.findUnique({ where: { id: hardhatSku.id }, select: { stockOnHand: true } });
  if ((hwHardhatStock?.stockOnHand ?? 0) < 10) {
    await logMovement(hardwareTenant.id, hardhatSku.id, MovementType.IN,    40, ReferenceType.MANUAL, "Initial stock",               undefined, hwMain);
  }

  // Contacts — created early so contactIds are available for orders
  const hwContactBgc     = await upsertContact(hardwareTenant.id, "BGC Construction Inc.", { type: ContactType.DISTRIBUTOR, phone: "09171234001", address: "BGC, Taguig City", creditLimitCents: 50000_00 });
  const hwContactAyala   = await upsertContact(hardwareTenant.id, "Ayala Land Procurement", { type: ContactType.DISTRIBUTOR, phone: "09171234002", address: "Makati CBD", creditLimitCents: 100000_00 });
  const mpsContactPalace = await upsertContact(foodTenant.id, "Pizza Palace Franchise",  { type: ContactType.DISTRIBUTOR, phone: "09181234011", address: "Cubao, Quezon City", creditLimitCents: 80000_00 });
  const mpsContactBella  = await upsertContact(foodTenant.id, "Bella Pizza QC",          { type: ContactType.CUSTOMER,    phone: "09281234012", address: "Katipunan Ave, QC", creditLimitCents: 20000_00 });
  const mpsContactStar   = await upsertContact(foodTenant.id, "Star Pizza Makati",       { type: ContactType.CUSTOMER,    phone: "09381234013", address: "Ayala Ave, Makati",  creditLimitCents: 15000_00 });
  const cgsContactBhall  = await upsertContact(retailTenant.id, "Barangay Hall Canteen", { type: ContactType.CUSTOMER,    phone: "09191234021", address: "Brgy. Hall, QC",     creditLimitCents: 3000_00 });
  const cgsContactSM     = await upsertContact(retailTenant.id, "SM Hypermarket Buyer",  { type: ContactType.DISTRIBUTOR, phone: "09291234022", address: "SM North EDSA",      creditLimitCents: 200000_00 });

  // Orders for Peak Hardware — create batch once (idempotent: skip if already seeded)
  const hwOrderCount = await prisma.order.count({ where: { tenantId: hardwareTenant.id } });
  if (hwOrderCount < 20) {
    const hw = hardwareTenant.id;
    const b = boltSku, w = washerSku, n = nutSku, c = cableSku, e = extCordSku, g = glovesSku, h = hardhatSku;
    const wh = hwMainBranch.id, rc = hwRetailBranch.id;

    const orders = [
      // PENDING — Main Warehouse
      await createOrder({ tenantId: hw, branchId: wh, customerRef: "BGC Construction PO #2241", status: OrderStatus.PENDING, items: [{ skuId: b.id, quantity: 100, priceCents: b.priceCents! }, { skuId: w.id, quantity: 200, priceCents: w.priceCents! }] }),
      await createOrder({ tenantId: hw, branchId: wh, customerRef: "Makati Contractor PO #517", status: OrderStatus.PENDING, items: [{ skuId: c.id, quantity: 5, priceCents: c.priceCents! }, { skuId: e.id, quantity: 3, priceCents: e.priceCents! }] }),
      await createOrder({ tenantId: hw, branchId: wh, customerRef: "SM North Site", status: OrderStatus.PENDING, items: [{ skuId: g.id, quantity: 10, priceCents: g.priceCents! }, { skuId: h.id, quantity: 3, priceCents: h.priceCents! }] }),
      // PENDING — Retail Counter
      await createOrder({ tenantId: hw, branchId: rc, customerRef: "Walk-in Customer", status: OrderStatus.PENDING, items: [{ skuId: e.id, quantity: 6, priceCents: e.priceCents! }, { skuId: b.id, quantity: 50, priceCents: b.priceCents! }] }),
      await createOrder({ tenantId: hw, branchId: rc, customerRef: "Pacific Mall Stall", status: OrderStatus.PENDING, items: [{ skuId: n.id, quantity: 500, priceCents: n.priceCents! }, { skuId: b.id, quantity: 300, priceCents: b.priceCents! }] }),
      await createOrder({ tenantId: hw, branchId: rc, customerRef: "Robinsons Hardware Buyer", status: OrderStatus.PENDING, items: [{ skuId: w.id, quantity: 300, priceCents: w.priceCents! }, { skuId: n.id, quantity: 300, priceCents: n.priceCents! }] }),
      // CONFIRMED — Main Warehouse
      await createOrder({ tenantId: hw, branchId: wh, customerRef: "Jollibee Katipunan PO #88", status: OrderStatus.CONFIRMED, deductStock: true, items: [{ skuId: c.id, quantity: 10, priceCents: c.priceCents! }, { skuId: e.id, quantity: 4, priceCents: e.priceCents! }] }),
      await createOrder({ tenantId: hw, branchId: wh, customerRef: "Ayala Land Project", status: OrderStatus.CONFIRMED, deductStock: true, items: [{ skuId: b.id, quantity: 200, priceCents: b.priceCents! }, { skuId: w.id, quantity: 200, priceCents: w.priceCents! }, { skuId: n.id, quantity: 200, priceCents: n.priceCents! }] }),
      // CONFIRMED — Retail Counter
      await createOrder({ tenantId: hw, branchId: rc, customerRef: "Walk-in Contractor", status: OrderStatus.CONFIRMED, deductStock: true, items: [{ skuId: g.id, quantity: 8, priceCents: g.priceCents! }, { skuId: b.id, quantity: 100, priceCents: b.priceCents! }] }),
      await createOrder({ tenantId: hw, branchId: rc, customerRef: "Valenzuela Site PO #31", status: OrderStatus.CONFIRMED, deductStock: true, items: [{ skuId: h.id, quantity: 5, priceCents: h.priceCents! }, { skuId: g.id, quantity: 5, priceCents: g.priceCents! }] }),
      // COMPLETED — Main Warehouse
      await createOrder({ tenantId: hw, branchId: wh, customerRef: "BGC Tower 3 Phase 2", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: b.id, quantity: 300, priceCents: b.priceCents! }, { skuId: w.id, quantity: 300, priceCents: w.priceCents! }] }),
      await createOrder({ tenantId: hw, branchId: wh, customerRef: "SM Skyway Project", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: e.id, quantity: 12, priceCents: e.priceCents! }, { skuId: c.id, quantity: 8, priceCents: c.priceCents! }] }),
      await createOrder({ tenantId: hw, branchId: wh, customerRef: "DMCI Homes PO #441", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: c.id, quantity: 20, priceCents: c.priceCents! }, { skuId: n.id, quantity: 150, priceCents: n.priceCents! }] }),
      await createOrder({ tenantId: hw, branchId: wh, customerRef: "Megaworld Site A", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: g.id, quantity: 15, priceCents: g.priceCents! }, { skuId: h.id, quantity: 8, priceCents: h.priceCents! }] }),
      await createOrder({ tenantId: hw, branchId: wh, customerRef: "Sta. Lucia Realty PO #89", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: b.id, quantity: 400, priceCents: b.priceCents! }, { skuId: n.id, quantity: 400, priceCents: n.priceCents! }] }),
      // COMPLETED — Retail Counter
      await createOrder({ tenantId: hw, branchId: rc, customerRef: "Cainta Hardware Walk-in", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: w.id, quantity: 150, priceCents: w.priceCents! }, { skuId: b.id, quantity: 100, priceCents: b.priceCents! }] }),
      await createOrder({ tenantId: hw, branchId: rc, customerRef: "Rodriguez Builder", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: e.id, quantity: 8, priceCents: e.priceCents! }, { skuId: c.id, quantity: 15, priceCents: c.priceCents! }] }),
      await createOrder({ tenantId: hw, branchId: rc, customerRef: "PO #2298 Quick Supply", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: h.id, quantity: 10, priceCents: h.priceCents! }, { skuId: g.id, quantity: 12, priceCents: g.priceCents! }] }),
      await createOrder({ tenantId: hw, branchId: rc, customerRef: "Antipolo Construction", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: b.id, quantity: 250, priceCents: b.priceCents! }, { skuId: w.id, quantity: 250, priceCents: w.priceCents! }, { skuId: n.id, quantity: 250, priceCents: n.priceCents! }] }),
      await createOrder({ tenantId: hw, branchId: rc, customerRef: "QC Safety Supplies", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: g.id, quantity: 20, priceCents: g.priceCents! }, { skuId: h.id, quantity: 5, priceCents: h.priceCents! }] }),
      await createOrder({ tenantId: hw, branchId: wh, customerRef: "Pasig River Dev PO #14", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: c.id, quantity: 30, priceCents: c.priceCents! }, { skuId: e.id, quantity: 6, priceCents: e.priceCents! }] }),
      // CANCELLED
      await createOrder({ tenantId: hw, branchId: rc, customerRef: "Walk-in (cancelled)", status: OrderStatus.CANCELLED, items: [{ skuId: e.id, quantity: 4, priceCents: e.priceCents! }, { skuId: b.id, quantity: 20, priceCents: b.priceCents! }] }),
      await createOrder({ tenantId: hw, branchId: wh, customerRef: "PO #190 Cancelled", status: OrderStatus.CANCELLED, items: [{ skuId: h.id, quantity: 2, priceCents: h.priceCents! }, { skuId: g.id, quantity: 4, priceCents: g.priceCents! }] }),
      await createOrder({ tenantId: hw, branchId: wh, customerRef: "Taguig Site Cancelled", status: OrderStatus.CANCELLED, items: [{ skuId: c.id, quantity: 8, priceCents: c.priceCents! }, { skuId: n.id, quantity: 50, priceCents: n.priceCents! }] }),
    ];

    // Payments for CONFIRMED and COMPLETED orders
    for (const order of orders) {
      if (order.status === OrderStatus.CONFIRMED) {
        await createPaymentIfAbsent({ tenantId: hw, orderId: order.id, amountCents: order.totalCents, status: PaymentStatus.PENDING, proofUrl: "https://example.com/receipts/phw-payment.jpg" });
      } else if (order.status === OrderStatus.COMPLETED) {
        await createPaymentIfAbsent({ tenantId: hw, orderId: order.id, amountCents: order.totalCents, status: PaymentStatus.VERIFIED, proofUrl: "https://example.com/receipts/phw-verified.jpg" });
      }
    }
  }

  // ===========================
  // METRO PIZZA SUPPLY
  // ===========================

  const flourSku = await upsertProductSku({
    tenantId: foodTenant.id, categoryId: cat["flour-grains"],
    productName: "All-Purpose Flour", skuCode: "MPS-FLOUR-25K",
    skuName: "All-Purpose Flour 25kg Sack", priceCents: 189000, costCents: 120000, lowStockThreshold: 5,
  });
  const mozzaSku = await upsertProductSku({
    tenantId: foodTenant.id, categoryId: cat["dairy-cheese"],
    productName: "Mozzarella Block", skuCode: "MPS-MOZZ-2K",
    skuName: "Mozzarella Block 2kg", priceCents: 145000, costCents: 95000, lowStockThreshold: 10,
  });
  const sauceSku = await upsertProductSku({
    tenantId: foodTenant.id, categoryId: cat["sauces-condiments"],
    productName: "Pizza Sauce", skuCode: "MPS-SAUCE-3K",
    skuName: "Pizza Sauce 3kg Can", priceCents: 62000, costCents: 38000, lowStockThreshold: 8,
  });
  const yeastSku = await upsertProductSku({
    tenantId: foodTenant.id, categoryId: cat["flour-grains"],
    productName: "Dry Active Yeast", skuCode: "MPS-YEAST-1K",
    skuName: "Dry Active Yeast 1kg", priceCents: 88000, costCents: 52000, lowStockThreshold: 10,
  });
  const oliveOilSku = await upsertProductSku({
    tenantId: foodTenant.id, categoryId: cat["sauces-condiments"],
    productName: "Extra Virgin Olive Oil", skuCode: "MPS-EVOO-5L",
    skuName: "Extra Virgin Olive Oil 5L", priceCents: 320000, costCents: 210000, lowStockThreshold: 4,
  });
  const pepperoniSku = await upsertProductSku({
    tenantId: foodTenant.id, categoryId: cat["dry-goods"],
    productName: "Pepperoni Slices", skuCode: "MPS-PEPPER-500G",
    skuName: "Pepperoni Slices 500g Pack", priceCents: 95000, costCents: 62000, lowStockThreshold: 15,
  });
  const tomatoesSku = await upsertProductSku({
    tenantId: foodTenant.id, categoryId: cat["sauces-condiments"],
    productName: "Canned Tomatoes", skuCode: "MPS-TOMATO-400G",
    skuName: "Crushed Canned Tomatoes 400g", priceCents: 38000, costCents: 22000, lowStockThreshold: 20,
  });
  // Archived SKU — discontinued
  await upsertProductSku({
    tenantId: foodTenant.id, categoryId: cat["dairy-cheese"],
    productName: "Parmesan Block (Discontinued)", skuCode: "MPS-PARM-1K",
    skuName: "Parmesan Block 1kg", priceCents: 280000, costCents: 190000, lowStockThreshold: 3,
    isArchived: true,
  });

  // Stock for Metro Pizza — each SKU has its own idempotency check so re-runs don't leave negative stock
  const mpsMain = mpsCentralBranch.id;

  const mpsFlourStock = await prisma.sku.findUnique({ where: { id: flourSku.id }, select: { stockOnHand: true } });
  if ((mpsFlourStock?.stockOnHand ?? 0) < 20) {
    await logMovement(foodTenant.id, flourSku.id, MovementType.IN, 200, ReferenceType.MANUAL, "Initial stock", undefined, mpsMain);
    await logMovement(foodTenant.id, flourSku.id, MovementType.OUT, 8, ReferenceType.MANUAL, "Delivered to client", undefined, mpsMain);
  }

  const mpsMozzarellaStock = await prisma.sku.findUnique({ where: { id: mozzaSku.id }, select: { stockOnHand: true } });
  if ((mpsMozzarellaStock?.stockOnHand ?? 0) < 20) {
    await logMovement(foodTenant.id, mozzaSku.id, MovementType.IN, 150, ReferenceType.MANUAL, "Initial stock", undefined, mpsMain);
    await logMovement(foodTenant.id, mozzaSku.id, MovementType.ADJUSTMENT, -5, ReferenceType.MANUAL, "Spoilage write-off", undefined, mpsMain);
  }

  const mpsSauceStock = await prisma.sku.findUnique({ where: { id: sauceSku.id }, select: { stockOnHand: true } });
  if ((mpsSauceStock?.stockOnHand ?? 0) < 20) {
    await logMovement(foodTenant.id, sauceSku.id, MovementType.IN, 120, ReferenceType.MANUAL, "Initial stock", undefined, mpsMain);
    await logMovement(foodTenant.id, sauceSku.id, MovementType.OUT, 6, ReferenceType.MANUAL, "Sold to restaurant", undefined, mpsMain);
  }

  const mpsYeastStock = await prisma.sku.findUnique({ where: { id: yeastSku.id }, select: { stockOnHand: true } });
  if ((mpsYeastStock?.stockOnHand ?? 0) < 20) {
    await logMovement(foodTenant.id, yeastSku.id, MovementType.IN, 100, ReferenceType.MANUAL, "Initial stock", undefined, mpsMain);
  }

  const mpsOliveOilStock = await prisma.sku.findUnique({ where: { id: oliveOilSku.id }, select: { stockOnHand: true } });
  if ((mpsOliveOilStock?.stockOnHand ?? 0) < 10) {
    await logMovement(foodTenant.id, oliveOilSku.id, MovementType.IN, 30, ReferenceType.MANUAL, "Initial stock", undefined, mpsMain);
  }

  const mpsPepperoniStock = await prisma.sku.findUnique({ where: { id: pepperoniSku.id }, select: { stockOnHand: true } });
  if ((mpsPepperoniStock?.stockOnHand ?? 0) < 20) {
    await logMovement(foodTenant.id, pepperoniSku.id, MovementType.IN, 100, ReferenceType.MANUAL, "Initial stock", undefined, mpsMain);
  }

  const mpsTomatoesStock = await prisma.sku.findUnique({ where: { id: tomatoesSku.id }, select: { stockOnHand: true } });
  if ((mpsTomatoesStock?.stockOnHand ?? 0) < 20) {
    await logMovement(foodTenant.id, tomatoesSku.id, MovementType.IN, 200, ReferenceType.MANUAL, "Initial stock", undefined, mpsMain);
  }

  // Orders for Metro Pizza — create batch once (idempotent: skip if already seeded)
  const mpsOrderCount = await prisma.order.count({ where: { tenantId: foodTenant.id } });
  if (mpsOrderCount < 18) {
    const tid = foodTenant.id;
    const f = flourSku, m = mozzaSku, s = sauceSku, y = yeastSku, o = oliveOilSku, p = pepperoniSku, t = tomatoesSku;
    const ck = mpsCentralBranch.id, ko = mpsKatiBranch.id;

    const orders = [
      // PENDING — Central Kitchen
      await createOrder({ tenantId: tid, branchId: ck, customerRef: "Pizza Palace Cubao Franchise #08", status: OrderStatus.PENDING, items: [{ skuId: f.id, quantity: 5, priceCents: f.priceCents! }, { skuId: s.id, quantity: 6, priceCents: s.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ck, customerRef: "Bella Pizza QC PO #33", status: OrderStatus.PENDING, items: [{ skuId: m.id, quantity: 8, priceCents: m.priceCents! }, { skuId: y.id, quantity: 5, priceCents: y.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ck, customerRef: "Star Pizza Makati", status: OrderStatus.PENDING, items: [{ skuId: p.id, quantity: 20, priceCents: p.priceCents! }, { skuId: t.id, quantity: 30, priceCents: t.priceCents! }] }),
      // PENDING — Katipunan Outlet
      await createOrder({ tenantId: tid, branchId: ko, customerRef: "Marco's Katipunan", status: OrderStatus.PENDING, items: [{ skuId: o.id, quantity: 4, priceCents: o.priceCents! }, { skuId: y.id, quantity: 10, priceCents: y.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ko, customerRef: "Baguio Franchise #014", status: OrderStatus.PENDING, items: [{ skuId: f.id, quantity: 10, priceCents: f.priceCents! }, { skuId: m.id, quantity: 5, priceCents: m.priceCents! }] }),
      // CONFIRMED — Central Kitchen
      await createOrder({ tenantId: tid, branchId: ck, customerRef: "Pizza Palace Cubao Monthly", status: OrderStatus.CONFIRMED, deductStock: true, items: [{ skuId: f.id, quantity: 10, priceCents: f.priceCents! }, { skuId: m.id, quantity: 15, priceCents: m.priceCents! }, { skuId: s.id, quantity: 12, priceCents: s.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ck, customerRef: "Bella Pizza Reorder", status: OrderStatus.CONFIRMED, deductStock: true, items: [{ skuId: p.id, quantity: 30, priceCents: p.priceCents! }, { skuId: t.id, quantity: 24, priceCents: t.priceCents! }] }),
      // CONFIRMED — Katipunan Outlet
      await createOrder({ tenantId: tid, branchId: ko, customerRef: "Katipunan Walk-in Bulk", status: OrderStatus.CONFIRMED, deductStock: true, items: [{ skuId: y.id, quantity: 15, priceCents: y.priceCents! }, { skuId: o.id, quantity: 3, priceCents: o.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ko, customerRef: "UP Village Restaurant", status: OrderStatus.CONFIRMED, deductStock: true, items: [{ skuId: t.id, quantity: 48, priceCents: t.priceCents! }, { skuId: s.id, quantity: 10, priceCents: s.priceCents! }] }),
      // COMPLETED — Central Kitchen
      await createOrder({ tenantId: tid, branchId: ck, customerRef: "Franchise #008 Monthly", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: m.id, quantity: 8, priceCents: m.priceCents! }, { skuId: f.id, quantity: 6, priceCents: f.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ck, customerRef: "Star Pizza Bulk Order", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: f.id, quantity: 15, priceCents: f.priceCents! }, { skuId: s.id, quantity: 10, priceCents: s.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ck, customerRef: "Manila Grand Hotel", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: p.id, quantity: 24, priceCents: p.priceCents! }, { skuId: t.id, quantity: 36, priceCents: t.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ck, customerRef: "Franchise #014 Reorder", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: o.id, quantity: 5, priceCents: o.priceCents! }, { skuId: y.id, quantity: 8, priceCents: y.priceCents! }] }),
      // COMPLETED — Katipunan Outlet
      await createOrder({ tenantId: tid, branchId: ko, customerRef: "Quezon Ave Pizza Co.", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: y.id, quantity: 20, priceCents: y.priceCents! }, { skuId: f.id, quantity: 8, priceCents: f.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ko, customerRef: "Katipunan Franchise #02", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: m.id, quantity: 12, priceCents: m.priceCents! }, { skuId: s.id, quantity: 15, priceCents: s.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ko, customerRef: "UP Diliman Canteen", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: t.id, quantity: 60, priceCents: t.priceCents! }, { skuId: p.id, quantity: 18, priceCents: p.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ko, customerRef: "Cubao Express PO #77", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: f.id, quantity: 20, priceCents: f.priceCents! }, { skuId: m.id, quantity: 6, priceCents: m.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ko, customerRef: "Anonas St. Kitchen", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: p.id, quantity: 40, priceCents: p.priceCents! }, { skuId: m.id, quantity: 10, priceCents: m.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ck, customerRef: "Franchise Central Restock", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: s.id, quantity: 18, priceCents: s.priceCents! }, { skuId: o.id, quantity: 2, priceCents: o.priceCents! }] }),
      // CANCELLED
      await createOrder({ tenantId: tid, branchId: ko, customerRef: "Kalayaan Ave (cancelled)", status: OrderStatus.CANCELLED, items: [{ skuId: o.id, quantity: 6, priceCents: o.priceCents! }, { skuId: y.id, quantity: 3, priceCents: y.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ck, customerRef: "PO #201 Cancelled", status: OrderStatus.CANCELLED, items: [{ skuId: f.id, quantity: 8, priceCents: f.priceCents! }, { skuId: y.id, quantity: 5, priceCents: y.priceCents! }] }),
    ];

    for (const order of orders) {
      if (order.status === OrderStatus.CONFIRMED) {
        await createPaymentIfAbsent({ tenantId: tid, orderId: order.id, amountCents: order.totalCents, status: PaymentStatus.PENDING, proofUrl: "https://example.com/receipts/mps-payment.jpg" });
      } else if (order.status === OrderStatus.COMPLETED) {
        await createPaymentIfAbsent({ tenantId: tid, orderId: order.id, amountCents: order.totalCents, status: PaymentStatus.VERIFIED, proofUrl: "https://example.com/receipts/mps-verified.jpg" });
      }
    }
  }

  // ===========================
  // CORNER GENERAL STORE
  // ===========================

  const colaSku = await upsertProductSku({
    tenantId: retailTenant.id, categoryId: cat["beverages"],
    productName: "Cola 355ml Can", skuCode: "CGS-COLA-355",
    skuName: "Cola 355ml Can", priceCents: 6500, costCents: 3800, lowStockThreshold: 24,
  });
  const chipsSku = await upsertProductSku({
    tenantId: retailTenant.id, categoryId: cat["snacks"],
    productName: "Potato Chips Original", skuCode: "CGS-CHIPS-OR",
    skuName: "Potato Chips Original 150g", priceCents: 9900, costCents: 5500, lowStockThreshold: 12,
  });
  const cleanerSku = await upsertProductSku({
    tenantId: retailTenant.id, categoryId: cat["cleaning-supplies"],
    productName: "All-Purpose Cleaner", skuCode: "CGS-CLEAN-1L",
    skuName: "All-Purpose Cleaner 1L", priceCents: 28500, costCents: 16000, lowStockThreshold: 6,
  });
  const waterSku = await upsertProductSku({
    tenantId: retailTenant.id, categoryId: cat["beverages"],
    productName: "Bottled Water 500ml", skuCode: "CGS-WATER-500",
    skuName: "Bottled Water 500ml", priceCents: 3500, costCents: 1800, lowStockThreshold: 48,
  });
  const noodlesSku = await upsertProductSku({
    tenantId: retailTenant.id, categoryId: cat["snacks"],
    productName: "Instant Noodles", skuCode: "CGS-NOODLE-1PK",
    skuName: "Instant Noodles Chicken Flavor", priceCents: 4500, costCents: 2500, lowStockThreshold: 24,
  });
  const detergentSku = await upsertProductSku({
    tenantId: retailTenant.id, categoryId: cat["cleaning-supplies"],
    productName: "Laundry Detergent", skuCode: "CGS-DETERG-1K",
    skuName: "Laundry Detergent Powder 1kg", priceCents: 35000, costCents: 20000, lowStockThreshold: 8,
  });
  const tissueSku = await upsertProductSku({
    tenantId: retailTenant.id, categoryId: cat["personal-care"],
    productName: "Tissue Box", skuCode: "CGS-TISSUE-200",
    skuName: "Facial Tissue Box 200 sheets", priceCents: 18500, costCents: 10000, lowStockThreshold: 10,
  });
  // Archived SKU — discontinued
  await upsertProductSku({
    tenantId: retailTenant.id, categoryId: cat["personal-care"],
    productName: "Bar Soap (Discontinued)", skuCode: "CGS-SOAP-100G",
    skuName: "Bar Soap 100g", priceCents: 5500, costCents: 3000, lowStockThreshold: 20,
    isArchived: true,
  });

  // Stock for Corner General — each SKU has its own idempotency check
  const cgsMain = cgsMainBranch.id;

  const cgsColaStock = await prisma.sku.findUnique({ where: { id: colaSku.id }, select: { stockOnHand: true } });
  if ((cgsColaStock?.stockOnHand ?? 0) < 100) {
    await logMovement(retailTenant.id, colaSku.id,      MovementType.IN,  1440, ReferenceType.MANUAL, "Initial stock",  undefined, cgsMain);
    await logMovement(retailTenant.id, colaSku.id,      MovementType.OUT,   36, ReferenceType.MANUAL, "Daily sales",    undefined, cgsMain);
  }

  const cgsChipsStock = await prisma.sku.findUnique({ where: { id: chipsSku.id }, select: { stockOnHand: true } });
  if ((cgsChipsStock?.stockOnHand ?? 0) < 50) {
    await logMovement(retailTenant.id, chipsSku.id,     MovementType.IN,         600, ReferenceType.MANUAL, "Initial stock",  undefined, cgsMain);
    await logMovement(retailTenant.id, chipsSku.id,     MovementType.ADJUSTMENT,  -12, ReferenceType.MANUAL, "Damaged stock",  undefined, cgsMain);
  }

  const cgsCleanerStock = await prisma.sku.findUnique({ where: { id: cleanerSku.id }, select: { stockOnHand: true } });
  if ((cgsCleanerStock?.stockOnHand ?? 0) < 50) {
    await logMovement(retailTenant.id, cleanerSku.id,   MovementType.IN,   240, ReferenceType.MANUAL, "Initial stock",  undefined, cgsMain);
  }

  const cgsWaterStock = await prisma.sku.findUnique({ where: { id: waterSku.id }, select: { stockOnHand: true } });
  if ((cgsWaterStock?.stockOnHand ?? 0) < 100) {
    await logMovement(retailTenant.id, waterSku.id,     MovementType.IN,  2400, ReferenceType.MANUAL, "Initial stock",  undefined, cgsMain);
    await logMovement(retailTenant.id, waterSku.id,     MovementType.OUT,  144, ReferenceType.MANUAL, "Daily sales",    undefined, cgsMain);
  }

  const cgsNoodlesStock = await prisma.sku.findUnique({ where: { id: noodlesSku.id }, select: { stockOnHand: true } });
  if ((cgsNoodlesStock?.stockOnHand ?? 0) < 50) {
    await logMovement(retailTenant.id, noodlesSku.id,   MovementType.IN,   480, ReferenceType.MANUAL, "Initial stock",  undefined, cgsMain);
  }

  const cgsDetergentStock = await prisma.sku.findUnique({ where: { id: detergentSku.id }, select: { stockOnHand: true } });
  if ((cgsDetergentStock?.stockOnHand ?? 0) < 50) {
    await logMovement(retailTenant.id, detergentSku.id, MovementType.IN,   100, ReferenceType.MANUAL, "Initial stock",  undefined, cgsMain);
  }

  const cgsTissueStock = await prisma.sku.findUnique({ where: { id: tissueSku.id }, select: { stockOnHand: true } });
  if ((cgsTissueStock?.stockOnHand ?? 0) < 50) {
    await logMovement(retailTenant.id, tissueSku.id,    MovementType.IN,   120, ReferenceType.MANUAL, "Initial stock",  undefined, cgsMain);
  }

  // Orders for Corner General — create batch once (idempotent: skip if already seeded)
  const cgsOrderCount = await prisma.order.count({ where: { tenantId: retailTenant.id } });
  if (cgsOrderCount < 18) {
    const tid = retailTenant.id;
    const co = colaSku, ch = chipsSku, cl = cleanerSku, wa = waterSku, no = noodlesSku, de = detergentSku, ti = tissueSku;
    const ms = cgsMainBranch.id, ax = cgsAnnexBranch.id;

    const orders = [
      // PENDING — Main Store
      await createOrder({ tenantId: tid, branchId: ms, customerRef: "Sari-sari Store Aling Nena", status: OrderStatus.PENDING, items: [{ skuId: co.id, quantity: 24, priceCents: co.priceCents! }, { skuId: ch.id, quantity: 12, priceCents: ch.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ms, customerRef: "Canteen Block B", status: OrderStatus.PENDING, items: [{ skuId: wa.id, quantity: 48, priceCents: wa.priceCents! }, { skuId: no.id, quantity: 12, priceCents: no.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ms, customerRef: "Talipapa Corner Buyer", status: OrderStatus.PENDING, items: [{ skuId: no.id, quantity: 24, priceCents: no.priceCents! }, { skuId: ti.id, quantity: 6, priceCents: ti.priceCents! }] }),
      // PENDING — Annex Branch
      await createOrder({ tenantId: tid, branchId: ax, customerRef: "Kiosk 7 Buyer", status: OrderStatus.PENDING, items: [{ skuId: de.id, quantity: 8, priceCents: de.priceCents! }, { skuId: cl.id, quantity: 6, priceCents: cl.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ax, customerRef: "Tindahan ni Ate Lucy", status: OrderStatus.PENDING, items: [{ skuId: co.id, quantity: 48, priceCents: co.priceCents! }, { skuId: wa.id, quantity: 96, priceCents: wa.priceCents! }] }),
      // CONFIRMED — Main Store
      await createOrder({ tenantId: tid, branchId: ms, customerRef: "Barangay Hall Canteen", status: OrderStatus.CONFIRMED, deductStock: true, items: [{ skuId: co.id, quantity: 72, priceCents: co.priceCents! }, { skuId: ch.id, quantity: 36, priceCents: ch.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ms, customerRef: "School Canteen Restock", status: OrderStatus.CONFIRMED, deductStock: true, items: [{ skuId: de.id, quantity: 12, priceCents: de.priceCents! }, { skuId: cl.id, quantity: 8, priceCents: cl.priceCents! }] }),
      // CONFIRMED — Annex Branch
      await createOrder({ tenantId: tid, branchId: ax, customerRef: "Market Vendor Bulk Order", status: OrderStatus.CONFIRMED, deductStock: true, items: [{ skuId: wa.id, quantity: 120, priceCents: wa.priceCents! }, { skuId: no.id, quantity: 48, priceCents: no.priceCents! }] }),
      // COMPLETED — Main Store
      await createOrder({ tenantId: tid, branchId: ms, customerRef: "SM Hypermarket Buyer", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: co.id, quantity: 48, priceCents: co.priceCents! }, { skuId: ch.id, quantity: 24, priceCents: ch.priceCents! }, { skuId: cl.id, quantity: 12, priceCents: cl.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ms, customerRef: "Puregold Partner", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: wa.id, quantity: 96, priceCents: wa.priceCents! }, { skuId: co.id, quantity: 36, priceCents: co.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ms, customerRef: "Tindahan ni Ate PO #12", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: no.id, quantity: 60, priceCents: no.priceCents! }, { skuId: ti.id, quantity: 12, priceCents: ti.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ms, customerRef: "Villamor Canteen", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: de.id, quantity: 15, priceCents: de.priceCents! }, { skuId: cl.id, quantity: 10, priceCents: cl.priceCents! }] }),
      // COMPLETED — Annex Branch
      await createOrder({ tenantId: tid, branchId: ax, customerRef: "Annex Bulk Buyer #01", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: co.id, quantity: 96, priceCents: co.priceCents! }, { skuId: wa.id, quantity: 144, priceCents: wa.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ax, customerRef: "Corner Sari-sari Restock", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: ch.id, quantity: 48, priceCents: ch.priceCents! }, { skuId: ti.id, quantity: 18, priceCents: ti.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ax, customerRef: "Blk 4 Canteen", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: cl.id, quantity: 24, priceCents: cl.priceCents! }, { skuId: de.id, quantity: 8, priceCents: de.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ax, customerRef: "Annex Walk-in Wholesale", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: no.id, quantity: 72, priceCents: no.priceCents! }, { skuId: ch.id, quantity: 30, priceCents: ch.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ms, customerRef: "Main Store Weekly Bulk", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: de.id, quantity: 10, priceCents: de.priceCents! }, { skuId: cl.id, quantity: 10, priceCents: cl.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ms, customerRef: "Catering Service Order", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: co.id, quantity: 120, priceCents: co.priceCents! }, { skuId: wa.id, quantity: 60, priceCents: wa.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ax, customerRef: "Annex Saturday Rush", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: wa.id, quantity: 200, priceCents: wa.priceCents! }, { skuId: no.id, quantity: 100, priceCents: no.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ms, customerRef: "Dampa Wet Market Buyer", status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: ch.id, quantity: 60, priceCents: ch.priceCents! }, { skuId: ti.id, quantity: 24, priceCents: ti.priceCents! }] }),
      // CANCELLED
      await createOrder({ tenantId: tid, branchId: ax, customerRef: "Annex (cancelled)", status: OrderStatus.CANCELLED, items: [{ skuId: cl.id, quantity: 6, priceCents: cl.priceCents! }, { skuId: de.id, quantity: 4, priceCents: de.priceCents! }] }),
      await createOrder({ tenantId: tid, branchId: ms, customerRef: "Walk-in Cancelled", status: OrderStatus.CANCELLED, items: [{ skuId: co.id, quantity: 12, priceCents: co.priceCents! }, { skuId: ch.id, quantity: 6, priceCents: ch.priceCents! }] }),
    ];

    for (const order of orders) {
      if (order.status === OrderStatus.CONFIRMED) {
        await createPaymentIfAbsent({ tenantId: tid, orderId: order.id, amountCents: order.totalCents, status: PaymentStatus.PENDING, proofUrl: "https://example.com/receipts/cgs-payment.jpg" });
      } else if (order.status === OrderStatus.COMPLETED) {
        await createPaymentIfAbsent({ tenantId: tid, orderId: order.id, amountCents: order.totalCents, status: PaymentStatus.VERIFIED, proofUrl: "https://example.com/receipts/cgs-verified.jpg" });
      }
    }
  }

  // ===========================
  // CONTACTS (all tenants — already created above for order linking)
  // ===========================

  // "Sari-sari Store Aling Nena" — created here so upsertContact is in scope
  await upsertContact(retailTenant.id, "Sari-sari Store Aling Nena", { type: ContactType.CUSTOMER, phone: "09391234023", creditLimitCents: 0 });

  // ===========================
  // TRANSFERS (all tenants)
  // ===========================

  async function createTransferIfAbsent(tenantId: string, fromBranchId: string, toBranchId: string, userId: string, items: Array<{ skuId: string; quantity: number }>, note?: string) {
    const existing = await prisma.stockTransferRequest.findFirst({ where: { tenantId, fromBranchId, toBranchId } });
    if (existing) return;

    const skus = await prisma.sku.findMany({ where: { id: { in: items.map((i) => i.skuId) }, tenantId }, select: { id: true, stockOnHand: true } });

    await prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransferRequest.create({
        data: {
          tenantId,
          fromBranchId,
          toBranchId,
          status: "FULFILLED",
          requestedById: userId,
          note: note ?? null,
          items: { create: items.map((i) => ({ skuId: i.skuId, quantity: i.quantity })) },
        },
      });

      for (const item of items) {
        const sku = skus.find((s) => s.id === item.skuId);
        if (!sku || sku.stockOnHand < item.quantity) continue; // skip if insufficient stock

        const pairId = randomUUID();
        await tx.inventoryMovement.create({ data: { tenantId, skuId: item.skuId, type: MovementType.TRANSFER_OUT, quantity: item.quantity, referenceType: ReferenceType.TRANSFER, referenceId: transfer.id, branchId: fromBranchId, transferPairId: pairId, actorId: userId } });
        await tx.sku.update({ where: { id: item.skuId }, data: { stockOnHand: { decrement: item.quantity } } });
        await tx.inventoryMovement.create({ data: { tenantId, skuId: item.skuId, type: MovementType.TRANSFER_IN, quantity: item.quantity, referenceType: ReferenceType.TRANSFER, referenceId: transfer.id, branchId: toBranchId, transferPairId: pairId, actorId: userId } });
        await tx.sku.update({ where: { id: item.skuId }, data: { stockOnHand: { increment: item.quantity } } });
      }
    });
  }

  // Use the owner user IDs for requestedBy
  await createTransferIfAbsent(
    hardwareTenant.id, hwMainBranch.id, hwRetailBranch.id, users.hardwareOwner.id,
    [{ skuId: boltSku.id, quantity: 200 }, { skuId: washerSku.id, quantity: 200 }, { skuId: glovesSku.id, quantity: 10 }],
    "Restocking retail counter from warehouse",
  );
  await createTransferIfAbsent(
    foodTenant.id, mpsCentralBranch.id, mpsKatiBranch.id, users.foodOwner.id,
    [{ skuId: flourSku.id, quantity: 20 }, { skuId: mozzaSku.id, quantity: 15 }, { skuId: sauceSku.id, quantity: 10 }],
    "Weekly supply to Katipunan outlet",
  );
  await createTransferIfAbsent(
    retailTenant.id, cgsMainBranch.id, cgsAnnexBranch.id, users.retailOwner.id,
    [{ skuId: colaSku.id, quantity: 120 }, { skuId: waterSku.id, quantity: 240 }, { skuId: noodlesSku.id, quantity: 60 }],
    "Annex branch restock",
  );

  // ===========================
  // CREDIT ORDERS (linked to contacts for AR demo)
  // ===========================

  const creditOrderCount = await prisma.order.count({ where: { contactId: { not: null } } });
  if (creditOrderCount < 6) {
    const futureDate = (days: number) => new Date(Date.now() + days * 86400_000);
    const pastDate   = (days: number) => new Date(Date.now() - days * 86400_000);

    // Peak Hardware — BGC Construction: 50% down, 50% pending
    const hwCreditOrder1 = await createOrder({ tenantId: hardwareTenant.id, branchId: hwMainBranch.id, customerRef: hwContactBgc.id, status: OrderStatus.CONFIRMED, deductStock: true, items: [{ skuId: boltSku.id, quantity: 500, priceCents: boltSku.priceCents! }, { skuId: washerSku.id, quantity: 500, priceCents: washerSku.priceCents! }] });
    await prisma.order.update({ where: { id: hwCreditOrder1.id }, data: { contactId: hwContactBgc.id, paymentDueDate: futureDate(14) } });
    await createPaymentIfAbsent({ tenantId: hardwareTenant.id, orderId: hwCreditOrder1.id, amountCents: Math.floor(hwCreditOrder1.totalCents / 2), status: PaymentStatus.VERIFIED });

    // Peak Hardware — Ayala Land: overdue
    const hwCreditOrder2 = await createOrder({ tenantId: hardwareTenant.id, branchId: hwMainBranch.id, customerRef: hwContactAyala.id, status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: cableSku.id, quantity: 30, priceCents: cableSku.priceCents! }, { skuId: hardhatSku.id, quantity: 10, priceCents: hardhatSku.priceCents! }] });
    await prisma.order.update({ where: { id: hwCreditOrder2.id }, data: { contactId: hwContactAyala.id, paymentDueDate: pastDate(7) } });

    // Metro Pizza — Pizza Palace: partial payment
    const mpsCreditOrder1 = await createOrder({ tenantId: foodTenant.id, branchId: mpsCentralBranch.id, customerRef: mpsContactPalace.id, status: OrderStatus.CONFIRMED, deductStock: true, items: [{ skuId: flourSku.id, quantity: 10, priceCents: flourSku.priceCents! }, { skuId: mozzaSku.id, quantity: 8, priceCents: mozzaSku.priceCents! }] });
    await prisma.order.update({ where: { id: mpsCreditOrder1.id }, data: { contactId: mpsContactPalace.id, paymentDueDate: futureDate(30) } });
    await createPaymentIfAbsent({ tenantId: foodTenant.id, orderId: mpsCreditOrder1.id, amountCents: Math.floor(mpsCreditOrder1.totalCents / 2), status: PaymentStatus.VERIFIED });

    // Metro Pizza — Bella Pizza: fully unpaid, overdue
    const mpsCreditOrder2 = await createOrder({ tenantId: foodTenant.id, branchId: mpsKatiBranch.id, customerRef: mpsContactBella.id, status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: sauceSku.id, quantity: 15, priceCents: sauceSku.priceCents! }, { skuId: yeastSku.id, quantity: 10, priceCents: yeastSku.priceCents! }] });
    await prisma.order.update({ where: { id: mpsCreditOrder2.id }, data: { contactId: mpsContactBella.id, paymentDueDate: pastDate(5) } });

    // Corner General — Barangay Hall: partially paid
    const cgsCreditOrder1 = await createOrder({ tenantId: retailTenant.id, branchId: cgsMainBranch.id, customerRef: cgsContactBhall.id, status: OrderStatus.CONFIRMED, deductStock: true, items: [{ skuId: colaSku.id, quantity: 48, priceCents: colaSku.priceCents! }, { skuId: waterSku.id, quantity: 96, priceCents: waterSku.priceCents! }] });
    await prisma.order.update({ where: { id: cgsCreditOrder1.id }, data: { contactId: cgsContactBhall.id, paymentDueDate: futureDate(7) } });
    await createPaymentIfAbsent({ tenantId: retailTenant.id, orderId: cgsCreditOrder1.id, amountCents: Math.floor(cgsCreditOrder1.totalCents / 2), status: PaymentStatus.VERIFIED });

    // Corner General — SM Hypermarket: overdue large account
    const cgsCreditOrder2 = await createOrder({ tenantId: retailTenant.id, branchId: cgsAnnexBranch.id, customerRef: cgsContactSM.id, status: OrderStatus.COMPLETED, deductStock: true, items: [{ skuId: detergentSku.id, quantity: 50, priceCents: detergentSku.priceCents! }, { skuId: tissueSku.id, quantity: 48, priceCents: tissueSku.priceCents! }] });
    await prisma.order.update({ where: { id: cgsCreditOrder2.id }, data: { contactId: cgsContactSM.id, paymentDueDate: pastDate(10) } });
    await createPaymentIfAbsent({ tenantId: retailTenant.id, orderId: cgsCreditOrder2.id, amountCents: Math.floor(cgsCreditOrder2.totalCents * 0.3), status: PaymentStatus.VERIFIED });

    // Suppress unused variable warnings
    void mpsContactStar;
  }

  // Summary
  const [orderTotal, paymentTotal, skuTotal, movementTotal, branchTotal, contactTotal, transferTotal] = await Promise.all([
    prisma.order.count(),
    prisma.payment.count(),
    prisma.sku.count(),
    prisma.inventoryMovement.count(),
    prisma.branch.count(),
    prisma.contact.count(),
    prisma.stockTransferRequest.count(),
  ]);

  console.log("✓ Admin:", admin.email);
  console.log("✓ Tenants:", hardwareTenant.slug, "|", foodTenant.slug, "|", retailTenant.slug);
  console.log("✓ Branches:", branchTotal, "(2 per tenant — typed: WAREHOUSE/PRODUCTION/STANDARD + RETAIL)");
  console.log("✓ SKUs:", skuTotal, "| Orders:", orderTotal, "| Payments:", paymentTotal, "| Movements:", movementTotal);
  console.log("✓ Contacts:", contactTotal, "| Transfers:", transferTotal);
  console.log("✓ Default password:", DEFAULT_PASSWORD);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
