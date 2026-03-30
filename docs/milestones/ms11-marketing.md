---
milestone: MS11
title: Operix Marketing Website
branch: milestone-11/marketing-site
status: in_progress
priority: PRE-STAGING (built before MS10 multi-branch)
last_updated: 2026-03-30
---

# MS11 — Operix Marketing Website

## Purpose

Public-facing static marketing site for Operix. Converts visitors to demo bookings via Calendly.
No self-registration — all onboarding is manual (Super Admin provisions tenants after demo call).

Target market: **Filipino-first, global-ready.** Currency and language features in the platform
are the scaffold for international expansion.

---

## App Location

`apps/marketing/` — standalone Next.js app in the monorepo. Deployed separately from the platform.

| URL | App |
|-----|-----|
| `operix.io` | `apps/marketing` (this) |
| `app.operix.io` | `apps/web` (the platform) |

---

## Design Decisions

| Decision | Answer |
|----------|--------|
| Framework | Next.js (static export — `output: 'export'`) |
| Styling | Tailwind CSS — same config as `apps/web` |
| Font | Inter |
| Primary color | Indigo `#4F46E5` |
| Accent color | Emerald `#10B981` |
| Self-registration | ❌ None. CTA = "Book a Demo" → Calendly |
| Pricing page | ❌ None. No tiers yet |
| Video | CSS-animated product walkthrough + voice-over audio |
| Dynamic features | `features.config.ts` mirrors `Tenant.features` keys — hidden features = no card rendered |

---

## Brand

| | |
|---|---|
| Name | Operix (placeholder — confirm before launch) |
| Headline | Stop juggling spreadsheets. Start running your business. |
| Subheadline | Operix brings inventory, orders, payments, and your team into one place — so you can focus on growth, not admin. |
| Tagline | One platform. Every operation. |

---

## Page Sections

| # | Section | Component | Asset status |
|---|---------|-----------|-------------|
| 1 | Navbar | `navbar.tsx` | — |
| 2 | Hero | `hero.tsx` | 🖼 Placeholder (swap with `/generate-image` when token ready) |
| 3 | Social proof bar | `social-proof.tsx` | 🖼 Placeholder logos |
| 4 | Features grid | `features-grid.tsx` | Dynamic from `features.config.ts` |
| 5 | How it works | `how-it-works.tsx` | 🖼 3× placeholder images |
| 6 | Demo section | `demo-section.tsx` | 🎙 Placeholder audio (`/audio/demo-voiceover.mp3`) |
| 7 | Testimonial | `testimonials.tsx` | 🖼 Placeholder avatar |
| 8 | Final CTA | `cta-section.tsx` | — |
| 9 | Footer | `footer.tsx` | — |

---

## Dynamic Features Config

Features shown on the marketing site are driven by `features.config.ts`.
Adding a new feature to the platform = one entry here to show it in the features grid.

| Feature key | Label | Shown today |
|-------------|-------|-------------|
| `inventory` | Inventory Tracking | ✅ |
| `orders` | Order Management | ✅ |
| `payments` | Payment Tracking | ✅ |
| `team` | Team & Permissions | ✅ |
| `catalog` | Product Catalog + CSV Import | ✅ |
| `reports` | Reports & Analytics | ❌ Not built yet |
| `multi_branch` | Multi-Branch Management | ❌ MS10 |
| `marketplace` | Marketplace | ❌ Phase 7 |

---

## Assets To Generate (when tokens are available)

| Asset | Command | Output path |
|-------|---------|-------------|
| Hero image | `/generate-image "modern business owner using inventory dashboard on laptop, clean office, natural light, Filipino context" --output apps/marketing/public/images/hero.webp --width 1200 --height 700` | `public/images/hero.webp` |
| How it works — step 1 | `/generate-image "product catalog on screen, inventory items, clean UI screenshot" --output apps/marketing/public/images/hiw-1.webp --width 600 --height 400` | `public/images/hiw-1.webp` |
| How it works — step 2 | `/generate-image "order management screen, list of orders, confirmation button" --output apps/marketing/public/images/hiw-2.webp --width 600 --height 400` | `public/images/hiw-2.webp` |
| How it works — step 3 | `/generate-image "payment confirmed screen, green checkmark, business dashboard" --output apps/marketing/public/images/hiw-3.webp --width 600 --height 400` | `public/images/hiw-3.webp` |
| Testimonial avatar | `/generate-image "professional Filipino business owner headshot, friendly smile, neutral background" --output apps/marketing/public/images/testimonial-avatar.webp --width 200 --height 200` | `public/images/testimonial-avatar.webp` |
| Voice-over | `/generate-voiceover "Meet Operix — the operations platform built for growing businesses. Add your products once. Track stock in real time. Create orders, confirm payments, and manage your team — all from one screen. Whether you're running one location or many, Operix keeps everything connected. Book a demo today." --output apps/marketing/public/audio/demo-voiceover.mp3` | `public/audio/demo-voiceover.mp3` |

---

## Definition of Done

- [ ] `apps/marketing` builds with `next build` and `next export`
- [ ] All 9 sections render correctly
- [ ] Features grid is dynamic — toggling a feature key hides the card
- [ ] Calendly URL is in `marketing.config.ts` (placeholder OK for now)
- [ ] All image slots have visible placeholders (no broken layout)
- [ ] Voice-over section renders without breaking when MP3 is missing
- [ ] Mobile responsive (320px → 1440px)
- [ ] `/audit` passed before PR
- [ ] `docs/MILESTONES.md` updated to ✅

---

## Post-Launch Checklist (before going live)

- [ ] Real domain set up (`operix.io`)
- [ ] Calendly URL configured
- [ ] All placeholder images replaced via `/generate-image`
- [ ] Voice-over generated via `/generate-voiceover`
- [ ] First client testimonial added (Manager's Pizza / Megabox)
- [ ] SEO meta tags reviewed
- [ ] OG image set
