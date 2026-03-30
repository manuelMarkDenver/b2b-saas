# Operix — Business Overview

### *One platform. Every operation.*

> **Prepared for:** Internal stakeholder review
> **Date:** March 30, 2026
> **Status:** Pre-staging — MVP complete, preparing for first real clients

---

## 1. What Is Operix?

Operix is a **B2B SaaS operations platform** built for growing businesses — starting with Filipino SMBs, built for the world.

It replaces the tangle of spreadsheets, chat threads, and disconnected apps that most small-to-medium businesses use to track their inventory, orders, and payments. Everything a business needs to run its daily operations lives in one screen, accessible from any device.

**The core problem it solves:**

> A business owner is managing orders on Viber, tracking stock on Excel, logging payments on another spreadsheet, and texting their staff when something changes. When something goes wrong — an oversold item, a missed payment, a stock discrepancy — there is no clear record of what happened or who did what.

Operix solves this with a clean, structured system where every action is tracked, every role has the right access, and every business can see exactly where they stand at any moment.

---

## 2. Who Is This For?

### Primary Market: Filipino SMBs

The Philippines has over **1 million registered SMBs** — hardware stores, food suppliers, wholesale distributors, and equipment dealers. Most are operating the same way they did 10 years ago: pen and paper, Excel, and WhatsApp.

These businesses are:

- Mobile-first (most staff are on Android phones)
- Price-sensitive (no appetite for enterprise pricing)
- Relationship-driven (trust matters more than brand)
- Underserved by existing tools (QuickBooks is overkill, generic apps don't fit the B2B context)

### First Clients (Proof of Concept)

Two real businesses are lined up as our first tenants — run by a family member:

| Business                  | Type                               | Primary Use Case                                         |
| ------------------------- | ---------------------------------- | -------------------------------------------------------- |
| **Manager's Pizza** | Food wholesale + franchise support | Orders from franchise outlets, central kitchen inventory |
| **Megabox**         | Pizza equipment supplier           | B2B orders from restaurants, warehouse stock management  |

Both businesses have confirmed the problems Operix solves. These are not hypothetical customers — they are the reason specific features were prioritized.

### Long-Term Market

Filipino-first is the **launch strategy**, not the ceiling. The platform is built to be global-ready:

- Multi-currency architecture (₱ hardcoded now, configurable per tenant in the roadmap)
- Multi-language capable (i18n plumbing in place)
- Multi-branch (scaling to regional chains and distributors)

The Southeast Asian SMB market — Philippines, Indonesia, Vietnam, Malaysia — is the medium-term expansion target. Global is the ambition.

---

## 3. What Is Already Built

The platform has completed its **MVP (Milestone 1 through 8)** — a fully functional, production-ready operations system.

### Core Platform — Fully Shipped ✅

| Feature                             | What It Does                                                                                                                                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Product Catalog**           | Add, edit, and organise products with SKUs. Bulk import via CSV. Archive discontinued items. Images per SKU.                                                                                                     |
| **Inventory Tracking**        | Real-time stock on hand. Every stock movement (in, out, adjustment) logged with who did it and why. Manual adjustments need ADMIN approval. Low-stock thresholds per item.                                       |
| **Order Management**          | Create orders from the catalog. Confirm, complete, or cancel. Stock deducted automatically on confirmation. Restored automatically on cancellation. Full status history. Customer reference and notes per order. |
| **Payment Tracking**          | Log proof-of-payment per order. Admin verifies or rejects. Clean payment history — no more chasing payments on chat.                                                                                            |
| **Team Management**           | Invite staff by email or add them directly (no email required — useful for warehouse staff with phone numbers only). Role-based access: Owner, Admin, Staff, Viewer. Deactivate instantly when someone leaves.  |
| **Security**                  | Password reset, rate limiting, CORS, security headers, JWT authentication. Forgot password works for email-registered staff; direct-add staff use a password change screen.                                      |
| **Notifications**             | In-app notification bell. Events: order confirmed, payment received, payment verified. Polling every 8 seconds — no refresh needed.                                                                             |
| **Multi-Tenant Architecture** | Each business is completely isolated. No business can see another's data. Enforced at every layer (database, API, UI).                                                                                           |
| **Super Admin Dashboard**     | Platform operator (us) can create tenants, toggle features per business, suspend or reactivate accounts.                                                                                                         |
| **File Uploads**              | Product images, tenant logos, user avatars, payment proofs. Local storage in dev; S3-ready for production.                                                                                                       |

### Tech Stack

| Layer             | Technology                                              |
| ----------------- | ------------------------------------------------------- |
| API               | NestJS (Node.js) — structured, production-grade        |
| Web App           | Next.js 15 — React, server-side rendered               |
| Database          | PostgreSQL via Neon (serverless, scales to zero in dev) |
| ORM               | Prisma — type-safe, migration-managed                  |
| Hosting (planned) | Vercel (web + marketing) + Render (API) + Neon (DB)     |
| Auth              | JWT with bcrypt password hashing                        |
| Storage           | Local in dev, AWS S3 in production                      |

### Quality Baseline

- **107 E2E tests passing** across all core flows
- **Tenant isolation audit** completed — confirmed no data leakage between businesses
- Seed data with 67 orders, 44 payments, 24 SKUs across 3 demo tenants

---

## 4. What Is In Progress Right Now

### Milestone 9 — Extensions ✅ (Just completed, PR open)

- Username scoping: staff can log in with a simple username + business code (no email required)
- Staff password change: direct-add staff can update their own password from settings
- Negative stock floor on manual adjustments: prevents stock from going below zero accidentally
- Customer reference on orders: every order can record who placed it (critical for B2B)

### Milestone 11 — Marketing Website 🚧 (Current)

A standalone marketing site (`apps/marketing`) — a separate Next.js app — is being built to serve as the public face of Operix:

- Full landing page: hero, features grid, how-it-works, testimonials, demo section, CTA
- CSS-rendered dashboard mockup in the hero (no API keys needed)
- Fictional Filipino business logos in social proof (real logos added when first clients go live)
- All copy centralised in a single config file — swap copy without touching components
- Calendly booking link (placeholder until Calendly is set up)
- Built to export as a fully static site — deployable anywhere, zero server cost

---

## 5. The Road to Launch

### Pre-Staging Checklist (in order)

These are the remaining items before any real client touches the platform:

| # | Item                                                                | Status         |
| - | ------------------------------------------------------------------- | -------------- |
| 1 | MS9 close (username, password change, stock floor, customerRef)     | ✅ Done        |
| 2 | Marketing website (MS11)                                            | ✅ Done        |
| 3 | Multi-branch scaffold (invisible at single-branch)                  | 📋 Next        |
| 4 | Dashboard / home screen (orders today, pending payments, low stock) | 📋 Planned     |
| 5 | Basic reports (orders CSV export, date filter)                      | 📋 Planned     |
| 6 | **Mobile responsive + PWA** — after all features stabilised   | 📋 Planned     |
| 7 | **Staging deployment** (Vercel + Render + Neon)               | 📋 Planned     |

Estimated pre-staging completion: **a few weeks of focused build.**

### Phase Roadmap

| Phase      | Theme                                               | Status                  |
| ---------- | --------------------------------------------------- | ----------------------- |
| Phase 1–4 | Foundation, Catalog, Operations, Hardening          | ✅ Complete (MVP)       |
| Phase 5    | CSV Import, Team Management, Multi-Branch           | 🚧 MS9 done, MS10 next  |
| Phase 6    | Marketing Website                                   | 🚧 In progress          |
| Phase 7    | Marketplace — customer storefront, payment gateway | 🔒 After validation     |
| Phase 8    | Mobile app (React Native), POS + barcode scanning   | 📋 Post-revenue         |
| Phase 9    | AWS scale, subdomain routing per tenant             | 🔒 When traffic demands |

---

## 6. Mobile Strategy

*This section directly addresses the question: "Is this app usable on mobile before launch?"*

### The Short Answer: Yes — but functionality comes first.

Mobile support ships **second-to-last before staging**, after all features are stabilised and MVP market-fit is confirmed. This is intentional: responsive CSS is tightly coupled to layout — adding each new panel would require re-doing mobile work. Do it once, when the UI is locked. The app will be fully usable on Android and iPhone before any real client signs up.

### How: PWA (Progressive Web App)

A PWA is a website that installs onto a phone's home screen like a native app — without going through an App Store. When a staff member visits `app.operix.io` on Android, Chrome shows:

> **"Add Operix to Home Screen"**

After tapping it:

- The app icon appears on the home screen
- It launches full-screen (no browser address bar)
- It has a splash screen on open
- It behaves exactly like a downloaded app for all daily tasks

This is how Shopify POS, Square Dashboard, and most modern B2B operations tools work at their early stage.

### Why Not a Native React Native App First?

|                      | React Native App      | PWA + Responsive Web |
| -------------------- | --------------------- | -------------------- |
| Time to ship         | +3–6 months          | +2–3 weeks          |
| Cost                 | High                  | Near zero            |
| App Store required   | Yes (weeks of review) | No                   |
| Feature updates      | Rebuild + resubmit    | Instant              |
| Same codebase as web | ❌                    | ✅                   |

For the target use cases — create an order at the counter, log a payment, check stock on the warehouse floor — a PWA is indistinguishable from a native app. The 5% of capabilities that only native apps provide (e.g., Bluetooth hardware for barcode scanners, POS receipt printers) are Phase 8 features that we don't need before launch.

### Role → Device Mapping

| Role            | Likely Device            | Daily Tasks                                  |
| --------------- | ------------------------ | -------------------------------------------- |
| Owner / Admin   | Phone or laptop          | Check reports, approve payments, manage team |
| Staff / Cashier | Android phone at counter | Create orders, log payment proof             |
| Warehouse staff | Android phone on floor   | Log stock movements, check inventory         |

### Native App: Phase 8

A React Native native app will be built **after** the product is validated with real clients and revenue justifies the investment. Building it now would delay the launch by 3–6 months for an improvement that a PWA already delivers for 95% of target use cases.

---

## 7. Revenue Model

### Current Approach: Calendly-First

No pricing page, no self-signup. Every new client books a demo via Calendly → we walk them through the platform → we create their account manually → they start using it.

This is intentional at this stage:

- We learn exactly what the first clients need before locking in pricing
- We avoid building a payment system before we have clients to test it with
- It forces a conversation — which is how trust is built in the Philippine market

### Planned Subscription Model (Post-Staging)

Pricing will be defined after the first 2–3 paying clients give us real feedback. Working assumptions:

| Tier                 | Target                                                               | Likely Price Point     |
| -------------------- | -------------------------------------------------------------------- | ---------------------- |
| **Starter**    | 1 branch, up to 5 staff, core features (inventory, orders, payments) | ₱500–₱800/month     |
| **Growth**     | Multiple branches, up to 20 staff, all features + reports            | ₱1,500–₱2,500/month |
| **Enterprise** | Unlimited branches, custom onboarding, priority support              | Custom / negotiated    |

*These are working estimates — not final. Pricing will be tested and adjusted based on what real clients will pay.*

### Revenue Assumptions

- **Philippine SMB sweet spot:** Monthly subscription, billed per business (not per user), priced below what a part-time bookkeeper costs
- **No per-transaction fees** at launch — flat monthly subscription is the simplest to explain and easiest to trust
- **Payment gateway** (Stripe / PayMongo for subscriptions) built when the first client is ready to pay online

---

## 8. Feature Backlog — What Comes After Launch

These are designed, scoped, and ready to build — not speculation:

| Feature                                                  | Priority     | Why It Matters                                                    |
| -------------------------------------------------------- | ------------ | ----------------------------------------------------------------- |
| Reports & Analytics                                      | 🔴 High      | "How much did we sell this month?" — day-one client ask          |
| Low Stock Alerts (email/SMS)                             | 🟡 Medium    | `lowStockThreshold` already on every SKU — just needs delivery |
| External Notifications (email, Messenger, WhatsApp)      | 🟡 Medium    | Philippine businesses are heavy Messenger/Viber users             |
| Multi-Branch Management                                  | 🟡 Medium    | Both first clients need this (central kitchen + outlets)          |
| i18n + Multi-Currency                                    | 🟢 Lower     | Unlocks non-PHP markets                                           |
| Marketplace / Customer Storefront                        | 🔒 Phase 7   | Customers browse and order without calling sales                  |
| AI Assistant (inventory suggestions, demand forecasting) | 🔒 Later     | Claude API + real tenant data — high value, high complexity      |
| Payroll Module                                           | 🔒 Regulated | High demand — validate first, build carefully                    |
| Shopee / Lazada Integration                              | 🔒 Later     | Platform integrations add significant complexity                  |

---

## 9. Competitive Positioning

### Who Else Is Out There?

| Tool                            | Problem                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| **QuickBooks / Xero**     | Accounting-first, not operations-first. Overkill for most Filipino SMBs. Expensive.        |
| **StoreHub / Loyverse**   | POS-focused, good for retail. Weak on B2B ordering, inventory movements, payment tracking. |
| **Google Sheets / Excel** | Free but manual, error-prone, no real-time visibility, no role-based access.               |
| **Custom-built systems**  | Expensive to build, expensive to maintain, no product roadmap.                             |

### Operix's Edge

1. **Operations-first, not accounting-first.** Built around how a distribution business actually works: receive stock, take orders, confirm, collect payment. Accounting exports come later.
2. **B2B context.** Customer references on orders, multi-item B2B ordering, proof-of-payment for manual transfers — all built-in. Consumer tools don't have this.
3. **Filipino context.** PHP currency, Filipino business naming conventions in the UI, GCash/BDO payment proof uploads, Messenger notification path in the roadmap.
4. **Multi-tenant, multi-branch.** One platform manages multiple businesses or multiple branches of the same business — under one operator account.
5. **Priced right.** Under ₱2,000/month for a team of 20. The price of one barista.

---

## 10. Our Dream for This

We are building Operix to become **the operations backbone for growing businesses in Southeast Asia** — and eventually, globally.

The vision, in plain terms:

> Every business that is still running on spreadsheets and group chats has the same problem. They need a system that is simple enough to learn in one afternoon, powerful enough to run their whole operation, and priced low enough that saying yes is easy.
>
> Operix is that system. Filipino-first, because that is where we know the problem best. But the problem is universal — and so is the solution.

The path:

1. **Launch with 2 real clients** → learn what actually matters in production
2. **Refine and charge** → first revenue, first pricing model validated
3. **Expand to 10–20 Filipino SMBs** → word-of-mouth is the channel; trust is the moat
4. **Southeast Asia** → Indonesia, Vietnam, Malaysia — same playbook, local context
5. **Global** → English-first international expansion, multi-currency, i18n, AWS scale

This is a long game. But the foundation is solid, the MVP is done, and the first clients are ready.

---

## 11. What We Need to Get There

### In the next 4–6 weeks (pre-staging):

- Finish the marketing site
- Complete the mobile-responsive pass + PWA
- Build the dashboard home screen
- Set up staging environment
- Onboard the first two clients

### In the 3 months after staging:

- Collect real client feedback
- Define and test pricing
- Add reports, notifications, and multi-branch
- Sign 3–5 paying clients

### To make the native mobile app worthwhile:

- Real revenue from real clients
- Explicit client ask for native app features (offline, push, hardware)
- Engineering capacity to maintain a second codebase

---

*Last updated: March 30, 2026*
*This document is internal and reflects the current state and direction of the Operix platform.*
