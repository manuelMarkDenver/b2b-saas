/**
 * marketing.config.ts
 *
 * Single source of truth for the Operix marketing site.
 * All copy, URLs, brand values, and toggles live here.
 * Change this file — the site updates everywhere.
 */

export const marketingConfig = {
  // ─── Brand ────────────────────────────────────────────────────────────────
  brand: {
    name: 'Operix',
    tagline: 'One platform. Every operation.',
    headline: 'Stop juggling spreadsheets.\nStart running your business.',
    subheadline:
      'Operix brings inventory, orders, payments, and your team into one place — so you can focus on growth, not admin.',
    logoText: 'Operix',
  },

  // ─── URLs ─────────────────────────────────────────────────────────────────
  urls: {
    /**
     * Replace with your real Calendly link when ready.
     * e.g. "https://calendly.com/yourname/operix-demo"
     */
    calendly: '',

    /**
     * URL of the main app (used in navbar "Sign in" link).
     */
    app: 'https://app.operix.io',

    social: {
      facebook: '',
      linkedin: '',
      twitter: '',
    },
  },

  // ─── Navigation ───────────────────────────────────────────────────────────
  nav: {
    links: [
      { label: 'Features', href: '#features' },
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Demo', href: '#demo' },
    ],
    ctaLabel: 'Book a Demo',
  },

  // ─── Hero ─────────────────────────────────────────────────────────────────
  hero: {
    ctaLabel: 'Book a Demo — it\'s free',
    ctaSubtext: 'No credit card. No commitment.',
    /**
     * Image: replace src with '/images/hero.webp' after running:
     * /generate-image "modern business owner using inventory dashboard on laptop,
     *   clean office, natural light, Filipino business context, indigo UI"
     *   --output apps/marketing/public/images/hero.webp --width 1200 --height 700
     */
    image: {
      src: '',   // empty = renders placeholder
      alt: 'Operix dashboard — inventory, orders, and payments in one screen',
      width: 1200,
      height: 700,
    },
  },

  // ─── Social proof ─────────────────────────────────────────────────────────
  socialProof: {
    label: 'Trusted by growing Filipino businesses',
    /**
     * Add real client logos here once onboarded.
     * { name: "Manager's Pizza", logoSrc: "/images/logos/managers-pizza.svg" }
     */
    logos: [] as Array<{ name: string; logoSrc: string }>,
  },

  // ─── How it works ─────────────────────────────────────────────────────────
  howItWorks: {
    title: 'Up and running in minutes',
    subtitle: 'Three steps from setup to your first confirmed order.',
    steps: [
      {
        number: '01',
        title: 'Add your products',
        description:
          'Upload your catalog in seconds — one by one or via CSV bulk import. Set prices, track units, and organise by category.',
        /**
         * /generate-image "clean product catalog dashboard, items listed with prices,
         *   modern UI, indigo color scheme" --output apps/marketing/public/images/hiw-1.webp
         *   --width 600 --height 400
         */
        image: { src: '', alt: 'Add products to Operix catalog', width: 600, height: 400 },
      },
      {
        number: '02',
        title: 'Create and confirm orders',
        description:
          'Build orders from your catalog, track status from Pending to Confirmed to Completed. Stock is deducted automatically on confirmation.',
        /**
         * /generate-image "order management screen with list of orders, status badges,
         *   confirm button, clean modern UI" --output apps/marketing/public/images/hiw-2.webp
         *   --width 600 --height 400
         */
        image: { src: '', alt: 'Create and manage orders in Operix', width: 600, height: 400 },
      },
      {
        number: '03',
        title: 'Track payments, close the loop',
        description:
          'Log payment proofs, verify receipts, and keep a clean financial record for every order. No more chasing payments on chat.',
        /**
         * /generate-image "payment verified screen, green checkmark, payment history list,
         *   business dashboard" --output apps/marketing/public/images/hiw-3.webp
         *   --width 600 --height 400
         */
        image: { src: '', alt: 'Track payments in Operix', width: 600, height: 400 },
      },
    ],
  },

  // ─── Demo section ─────────────────────────────────────────────────────────
  demo: {
    title: 'See Operix in action',
    subtitle: 'Watch how a growing business manages daily ops — start to finish.',
    /**
     * Voice-over audio. Generate with:
     * /generate-voiceover "Meet Operix — the operations platform built for growing
     *   businesses. Add your products once. Track stock in real time. Create orders,
     *   confirm payments, and manage your team — all from one screen. Whether you're
     *   running one location or many, Operix keeps everything connected.
     *   Book a demo today."
     *   --output apps/marketing/public/audio/demo-voiceover.mp3
     */
    audioSrc: '/audio/demo-voiceover.mp3', // file may not exist yet — no broken UI
    voiceoverScript:
      "Meet Operix — the operations platform built for growing businesses. Add your products once. Track stock in real time. Create orders, confirm payments, and manage your team — all from one screen. Whether you're running one location or many, Operix keeps everything connected. Book a demo today.",
  },

  // ─── Testimonial ──────────────────────────────────────────────────────────
  testimonial: {
    quote:
      'Before Operix, I was tracking everything on three different spreadsheets. Now I can see all my stock and orders from my phone in one place.',
    author: 'Business Owner',
    company: 'Growing Filipino Business',
    /**
     * /generate-image "professional Filipino business owner headshot, friendly
     *   confident smile, neutral background, natural light portrait"
     *   --output apps/marketing/public/images/testimonial-avatar.webp --width 200 --height 200
     */
    avatarSrc: '',
    isPlaceholder: true, // hides when false + real quote added
  },

  // ─── Final CTA ────────────────────────────────────────────────────────────
  finalCta: {
    title: 'Ready to simplify your operations?',
    subtitle: 'Join businesses already running on Operix. Book a free demo — we\'ll walk you through everything.',
    ctaLabel: 'Book a Demo',
    secondaryLabel: 'Learn more',
    secondaryHref: '#features',
  },

  // ─── Footer ───────────────────────────────────────────────────────────────
  footer: {
    tagline: 'One platform. Every operation.',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Book a Demo', href: '' }, // calendly — filled from urls.calendly
    ],
    copyright: `© ${new Date().getFullYear()} Operix. All rights reserved.`,
    madeIn: 'Made in the Philippines 🇵🇭 — built for the world.',
  },
} as const;
