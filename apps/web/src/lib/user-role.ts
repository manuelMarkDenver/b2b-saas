/** Per-tenant user role stored in localStorage. Key: `role:{tenantSlug}` */
const key = (tenantSlug: string) => `role:${tenantSlug}`;

export function getUserRole(tenantSlug: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key(tenantSlug));
}

export function setUserRole(tenantSlug: string, role: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key(tenantSlug), role);
}

export function isStaff(tenantSlug: string): boolean {
  const role = getUserRole(tenantSlug);
  return role === 'STAFF';
}

export function isOwnerOrAdmin(tenantSlug: string): boolean {
  const role = getUserRole(tenantSlug);
  return role === 'OWNER' || role === 'ADMIN';
}
