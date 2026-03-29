'use client';

import Image from 'next/image';

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function pickInitials(label: string) {
  const cleaned = label.trim();
  if (!cleaned) return 'PR';

  const parts = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '');

  const initials = parts.join('');
  return initials || cleaned.slice(0, 2).toUpperCase();
}

function hashString(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function defaultThumbDataUrl(label: string) {
  const initials = pickInitials(label);
  const h = hashString(label);
  const palettes = [
    ['#0B2A3C', '#1F3B5C'],
    ['#2B1B3B', '#4B2D6B'],
    ['#12302A', '#1B4A3D'],
    ['#2F2A16', '#4A3F1B'],
    ['#1B2430', '#243B55'],
  ];
  const [c1, c2] = palettes[h % palettes.length];

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="96" height="96" rx="18" fill="url(#g)"/>
  <rect x="10" y="10" width="76" height="76" rx="14" fill="rgba(255,255,255,0.06)"/>
  <text x="50" y="56" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="28" font-weight="700" fill="rgba(255,255,255,0.88)">${initials}</text>
</svg>`;

  return svgToDataUrl(svg);
}

export function ProductThumb({
  src,
  label,
  size = 28,
  className,
}: {
  src?: string | null;
  label: string;
  size?: number;
  className?: string;
}) {
  const fallback = defaultThumbDataUrl(label);
  const finalSrc = src?.trim() ? src : fallback;

  return (
    <Image
      src={finalSrc}
      alt={label}
      width={size}
      height={size}
      className={className ?? 'shrink-0 rounded-md border border-border/60'}
    />
  );
}
