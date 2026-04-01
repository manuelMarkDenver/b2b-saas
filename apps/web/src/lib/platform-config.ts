/**
 * Platform branding configuration.
 *
 * All values are driven by NEXT_PUBLIC_PLATFORM_* environment variables so
 * every white-label deployment can override them without code changes.
 *
 * Tier 1/2 (Ascendex):     deploy as-is; defaults point to Ascendex branding.
 * Tier 3 (MGN white-label): set NEXT_PUBLIC_PLATFORM_NAME=MGN Business Suite,
 *                            NEXT_PUBLIC_PLATFORM_LOGO_ICON_URL=<mgn-icon-url>, etc.
 * Tier 4 (reseller):        same approach — separate deployment, different env vars.
 */
export interface PlatformConfig {
  /** Product display name — shown in sidebar header and auth pages. e.g. "Zentral" */
  name: string;
  /** Short descriptor shown on login/register screens. */
  tagline: string;
  /**
   * URL to a custom icon image (PNG/SVG) for white-label deployments.
   * When null, the sidebar renders the built-in inline Zentral SVG icon,
   * which supports currentColor and dark/light mode automatically.
   */
  logoIconUrl: string | null;
  /** Support e-mail linked in error pages and emails. */
  supportEmail: string;
  /** Link used on "Back to marketing" buttons on auth pages. */
  marketingUrl: string;
  /**
   * Parent company name shown as "Powered by {parentCompanyName}" at the
   * bottom of the sidebar. Set to null or NEXT_PUBLIC_PLATFORM_SHOW_POWERED_BY=false
   * to hide it entirely (white-label deployments).
   */
  parentCompanyName: string | null;
  /** Whether to show the "Powered by {parentCompanyName}" footer in the sidebar. */
  showPoweredBy: boolean;
}

export const platformConfig: PlatformConfig = {
  name:              process.env.NEXT_PUBLIC_PLATFORM_NAME              ?? 'Zentral',
  tagline:           process.env.NEXT_PUBLIC_PLATFORM_TAGLINE           ?? 'Business Operations Platform',
  // null = use built-in inline SVG; white-label clients set a hosted image URL
  logoIconUrl:       process.env.NEXT_PUBLIC_PLATFORM_LOGO_ICON_URL     ?? null,
  supportEmail:      process.env.NEXT_PUBLIC_PLATFORM_SUPPORT_EMAIL     ?? 'support@zentral.ph',
  marketingUrl:      process.env.NEXT_PUBLIC_PLATFORM_MARKETING_URL     ?? 'https://zentral.ph',
  // Parent company credit — set NEXT_PUBLIC_PLATFORM_SHOW_POWERED_BY=false to hide for white-label
  parentCompanyName: process.env.NEXT_PUBLIC_PLATFORM_PARENT_NAME       ?? 'Ascendex',
  showPoweredBy:    (process.env.NEXT_PUBLIC_PLATFORM_SHOW_POWERED_BY   ?? 'true') !== 'false',
};
