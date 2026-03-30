import { getToken } from "@/lib/auth";
import { getActiveBranchId } from "@/lib/branch";

type ApiOptions = RequestInit & {
  tenantSlug?: string;
  /** Explicit branch override. If omitted and tenantSlug provided, falls back to localStorage. */
  branchId?: string | null;
};

export async function apiFetch(path: string, options: ApiOptions = {}) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new Error("NEXT_PUBLIC_API_BASE_URL not set");

  const token = getToken();
  const headers = new Headers(options.headers ?? {});
  // Don't set Content-Type for FormData — browser sets it with the boundary automatically
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.tenantSlug) headers.set("x-tenant-slug", options.tenantSlug);

  // Branch filtering: explicit > localStorage > none
  const branchId =
    options.branchId !== undefined
      ? options.branchId
      : options.tenantSlug
        ? getActiveBranchId(options.tenantSlug)
        : null;
  if (branchId) headers.set("x-branch-id", branchId);

  const res = await fetch(`${base}${path}`, {
    ...options,
    headers,
  });

  return res;
}
