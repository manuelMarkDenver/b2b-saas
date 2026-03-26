import { getToken } from "@/lib/auth";

type ApiOptions = RequestInit & {
  tenantSlug?: string;
};

export async function apiFetch(path: string, options: ApiOptions = {}) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new Error("NEXT_PUBLIC_API_BASE_URL not set");

  const token = getToken();
  const headers = new Headers(options.headers ?? {});
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.tenantSlug) headers.set("x-tenant-slug", options.tenantSlug);

  const res = await fetch(`${base}${path}`, {
    ...options,
    headers,
  });

  return res;
}
