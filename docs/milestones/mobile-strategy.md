# Mobile Strategy — Why PWA First, Native App Later

> Written: 2026-03-30
> Context: Decision made after wife raised valid concern that Filipino SMBs are mobile-first
> and the app shouldn't launch without mobile support.

---

## The Concern (Valid)

The Philippines is one of the most mobile-heavy markets in Southeast Asia.
Most small business owners and their staff operate from Android phones.
A desktop-only B2B app will have friction at every demo and in daily use.

Staff use cases that happen on mobile:
- Cashier at the counter → create order, log payment proof
- Warehouse staff on the floor → check stock, log movements
- Owner on the go → check today's orders, approve payments

---

## Why Not a Native App First?

| Factor | React Native App | PWA + Responsive Web |
|--------|-----------------|---------------------|
| Timeline to ship | +3–6 months | +2–3 weeks |
| Engineering cost | High (new codebase, new toolchain) | Near zero (CSS + manifest.json) |
| App Store approval | Required (weeks of delay + annual fees) | Not needed |
| Feature updates | Requires rebuild + resubmit per platform | Instant, same as web deploy |
| Offline support | Full | Partial (service worker) |
| Install experience | App Store / Play Store download | "Add to Home Screen" prompt |
| Push notifications | Full native | Full on Android, limited on iOS |
| Same codebase as web | ❌ | ✅ |

For B2B staff tools (not consumer apps), the "Add to Home Screen" install experience
is entirely sufficient. Users are not browsing an app store — they're given a URL by their
employer and told to install it.

Shopify POS, Square Dashboard, and most modern B2B operations tools are PWA or
mobile-responsive web — not native apps — at their early stage.

---

## The Decision

**Sequencing:** PWA + responsive web is done **second-to-last before staging** — after all functionality is stabilised and MVP market-fit is confirmed. Rationale: responsive CSS is tightly coupled to layout. Adding a new panel (dashboard, reports, branch switcher) means re-doing responsive work. Do it once, when the UI is stable.

**Stage 1 (Pre-staging, second-to-last):** PWA + fully mobile-responsive `apps/web`
- `manifest.json` with Operix branding → installable on Android and iOS
- Service worker → basic offline capability (load last-viewed data)
- Full responsive CSS pass on all panels: sidebar, orders, inventory, payments, team
- Optimised touch targets (min 44×44px), larger text, swipe-friendly layouts

**Stage 2 (Phase 8, post-revenue):** React Native native app
- Only after real clients are using the PWA and explicitly requesting a native app
- Only after the product is stable and revenue justifies the engineering investment
- POS hardware integration (barcode scanners, receipt printers) also unlocks here

---

## What the PWA Gives You at Launch

When an Android user visits `app.operix.io`, Chrome shows a banner:
> "Add Operix to Home Screen"

After tapping:
- Full-screen launch (no browser chrome)
- App icon on the home screen
- Splash screen on open
- Looks and feels like a native app for all operational tasks

iOS users (Safari) can manually "Add to Home Screen" — same result.

---

## Summary for Stakeholders

> Your wife is right about the problem. Filipino SMBs are mobile-first and the app
> must work on mobile before launch. The solution is a PWA — not a native app.
>
> A PWA installs from the browser onto any Android or iPhone home screen,
> launches full-screen, and works like a native app for all daily operations
> (orders, stock, payments). It ships in weeks, not months, at near-zero cost,
> and every feature update goes live instantly without App Store submissions.
>
> A native React Native app will be built in Phase 8 — after the product is
> validated with real clients and revenue justifies the investment.
> Building it now would delay the launch by 3–6 months for a benefit
> that a PWA already delivers for 95% of the target use cases.
