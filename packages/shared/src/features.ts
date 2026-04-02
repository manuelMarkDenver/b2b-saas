/**
 * PLATFORM FEATURE REGISTRY — Single Source of Truth
 * =====================================================
 *
 * This is the ONE place where platform features are defined.
 * Every other part of the system derives from this:
 *
 *   apps/api   → FeatureFlag union type (feature-flag.guard.ts)
 *   apps/web   → sidebar nav items, admin feature toggles
 *   apps/marketing → features grid (shows only `shipped: true`)
 *
 * "Is a feature REALLY on for a tenant?"
 * ----------------------------------------
 * A feature is active when BOTH conditions are true:
 *   1. `shipped: true`  — the feature is built and working in the platform
 *   2. `tenant.features[key] === true`  — Super Admin granted it to this tenant
 *
 * If shipped is false, the feature cannot be enabled — routes don't exist yet.
 * If shipped is true but tenant.features[key] is false, the API guard blocks access.
 *
 * Workflow when shipping a new feature:
 *   1. Build the feature, add its API routes behind FeatureFlagGuard
 *   2. Set `shipped: true` here
 *   3. Marketing site automatically shows it (no other change needed)
 *   4. Super Admin grants it to tenants via admin panel
 */

export type PlatformFeature = {
  /** Matches the key in Tenant.features JSON exactly */
  key: string;
  label: string;
  description: string;
  /** Lucide icon name (PascalCase) */
  icon: string;
  /**
   * true  = feature is built, routes exist, can be granted to tenants
   * false = not built yet — hidden from marketing, cannot be enabled in admin panel
   */
  shipped: boolean;
  /** Optional badge shown on marketing cards and admin toggles */
  badge?: string;
  /** Phase this feature is planned for (informational) */
  phase?: string;
};

export const PLATFORM_FEATURES: PlatformFeature[] = [
  {
    key: 'inventory',
    label: 'Inventory Tracking',
    description:
      'Know exactly what you have at all times. Track stock movements, set low-stock alerts, and never oversell again.',
    icon: 'Package',
    shipped: true,
  },
  {
    key: 'orders',
    label: 'Order Management',
    description:
      'Create, confirm, and complete orders with full status history. Stock is deducted automatically on confirmation.',
    icon: 'ShoppingCart',
    shipped: true,
  },
  {
    key: 'payments',
    label: 'Payment Tracking',
    description:
      'Log payment proofs, verify receipts, and maintain a clean financial record tied to every order.',
    icon: 'CreditCard',
    shipped: true,
  },
  {
    key: 'team',
    label: 'Team & Permissions',
    description:
      'Invite staff by email or add them directly — no email required. Role-based access keeps everyone in their lane.',
    icon: 'Users',
    shipped: true,
  },
  {
    key: 'catalog',
    label: 'Product Catalog',
    description:
      'Build your catalog fast. Add products one by one or bulk-import via CSV. Organise by category, set prices, archive discontinued items.',
    icon: 'BookOpen',
    shipped: true,
  },
  {
    key: 'reports',
    label: 'Reports & Analytics',
    description:
      'Sales summaries, low stock reports, and payment breakdowns — all in one view. Export to CSV anytime.',
    icon: 'BarChart2',
    shipped: true,
  },
  {
    key: 'multi_branch',
    label: 'Multi-Branch Management',
    description:
      'Run multiple locations under one account. Independent stock per branch, shared catalog, consolidated reporting.',
    icon: 'GitBranch',
    shipped: false,
    badge: 'Coming soon',
    phase: 'MS10',
  },
  {
    key: 'stockTransfers',
    label: 'Stock Transfers',
    description:
      'Move inventory between branches with a formal request and approval flow. Full audit trail of every transfer.',
    icon: 'ArrowLeftRight',
    shipped: false,
    badge: 'Coming soon',
    phase: 'MS21',
  },
  {
    key: 'paymentTerms',
    label: 'Payment Terms & AR',
    description:
      'Extend credit to distributors and key accounts. Track balances, set due dates, and monitor outstanding AR across all contacts.',
    icon: 'Receipt',
    shipped: false,
    badge: 'Coming soon',
    phase: 'MS20',
  },
  {
    key: 'marketplace',
    label: 'Marketplace',
    description:
      'List your products on the Zentral marketplace and reach customers across the platform.',
    icon: 'Store',
    shipped: false,
    phase: 'Phase 7',
  },
];

/**
 * Only features that are built and working.
 * Use this for:
 *   - Generating the FeatureFlag union type in the API
 *   - Showing toggles in the admin panel
 *   - Validating tenant.features keys
 */
export const SHIPPED_FEATURES = PLATFORM_FEATURES.filter((f) => f.shipped);

/**
 * FeatureFlag union — derived automatically from shipped features.
 * Import this in feature-flag.guard.ts instead of a hardcoded union.
 *
 * Example: 'inventory' | 'orders' | 'payments' | 'team' | 'catalog'
 */
export type FeatureFlag = (typeof SHIPPED_FEATURES)[number]['key'];

/**
 * Helper: is a feature both shipped AND enabled for a given tenant features object?
 * Use this in the web app when you need a definitive answer.
 *
 * @example
 * isFeatureActive('inventory', tenant.features) // → true | false
 */
export function isFeatureActive(
  key: string,
  tenantFeatures: Record<string, boolean> | null | undefined,
): boolean {
  const feature = PLATFORM_FEATURES.find((f) => f.key === key);
  if (!feature || !feature.shipped) return false;
  return tenantFeatures?.[key] === true;
}
