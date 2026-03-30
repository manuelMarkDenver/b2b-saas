/**
 * features.config.ts
 *
 * The marketing site's feature list is derived directly from the platform
 * registry in @repo/shared — NOT maintained separately.
 *
 * "shipped: true" in the platform registry = feature card shown on the marketing site.
 * "shipped: false" = hidden (not built yet, not announced).
 *
 * To add a new feature to the marketing site:
 *   1. Build the feature in the platform
 *   2. Set `shipped: true` in packages/shared/src/features.ts
 *   3. The card appears here automatically — no other change needed.
 */

export { PLATFORM_FEATURES as featuresConfig } from '@repo/shared';
export type { PlatformFeature as FeatureCard } from '@repo/shared';
