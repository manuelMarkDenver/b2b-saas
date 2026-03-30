/** Per-tenant active branch stored in localStorage. Key: `branch:{tenantSlug}` */
const key = (tenantSlug: string) => `branch:${tenantSlug}`;

export function getActiveBranchId(tenantSlug: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key(tenantSlug));
}

export function setActiveBranchId(tenantSlug: string, branchId: string | null) {
  if (typeof window === 'undefined') return;
  if (branchId) {
    localStorage.setItem(key(tenantSlug), branchId);
  } else {
    localStorage.removeItem(key(tenantSlug));
  }
}
