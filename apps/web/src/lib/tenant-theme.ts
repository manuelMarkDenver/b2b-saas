export type TenantThemeTokens = {
  brandName: string;
  // HSL triplets without `hsl(...)` wrapper, e.g. "222.2 84% 4.9%"
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  radius: string;
};

const DEFAULT_TENANT: TenantThemeTokens = {
  brandName: "Marketplace",
  primary: "221.2 83.2% 53.3%",
  primaryForeground: "210 40% 98%",
  accent: "210 40% 96.1%",
  accentForeground: "222.2 47.4% 11.2%",
  radius: "0.75rem",
};

const TENANT_THEMES: Record<string, TenantThemeTokens> = {
  acme: {
    brandName: "Acme Supply",
    primary: "16 85% 54%",
    primaryForeground: "210 40% 98%",
    accent: "24 95% 92%",
    accentForeground: "18 78% 15%",
    radius: "0.9rem",
  },
  beacon: {
    brandName: "Beacon Trading",
    primary: "199 89% 48%",
    primaryForeground: "210 40% 98%",
    accent: "200 40% 96%",
    accentForeground: "199 60% 16%",
    radius: "0.75rem",
  },
};

export function getTenantTheme(tenantSlug: string | undefined): TenantThemeTokens {
  if (!tenantSlug) return DEFAULT_TENANT;
  return TENANT_THEMES[tenantSlug.toLowerCase()] ?? DEFAULT_TENANT;
}
