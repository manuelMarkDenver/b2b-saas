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
  /** Platform display name — shown in sidebar header and auth pages. */
  name: string;
  /** Short descriptor shown on login/register screens. */
  tagline: string;
  /**
   * URL to a custom icon image (PNG/SVG) for white-label deployments.
   * When null, the sidebar renders the built-in inline Ascendex SVG icon,
   * which supports currentColor and dark/light mode automatically.
   */
  logoIconUrl: string | null;
  /** Support e-mail linked in error pages and emails. */
  supportEmail: string;
  /** Link used on "Back to marketing" buttons on auth pages. */
  marketingUrl: string;
}

export const platformConfig: PlatformConfig = {
  name:         process.env.NEXT_PUBLIC_PLATFORM_NAME         ?? 'Ascendex',
  tagline:      process.env.NEXT_PUBLIC_PLATFORM_TAGLINE      ?? 'Business Operations Platform',
  // null = use built-in inline SVG; white-label clients set a hosted image URL
  logoIconUrl:  process.env.NEXT_PUBLIC_PLATFORM_LOGO_ICON_URL ?? null,
  supportEmail: process.env.NEXT_PUBLIC_PLATFORM_SUPPORT_EMAIL ?? 'support@ascendex.ph',
  marketingUrl: process.env.NEXT_PUBLIC_PLATFORM_MARKETING_URL ?? 'https://ascendex.ph',
};
