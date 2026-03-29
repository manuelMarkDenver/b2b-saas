"use client";

import Image from "next/image";
import { Camera } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

/** Deterministic hue from a string so each label gets a consistent color. */
export function labelHue(label: string): number {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

function NoImagePlaceholder({
  label,
  size,
  fill,
  caption,
  className,
}: {
  label: string;
  size: number;
  fill?: boolean;
  caption?: string;
  className?: string;
}) {
  if (fill || size >= 64) {
    const iconSize = fill ? 28 : 22;
    return (
      <div
        aria-label={`${label} (no image)`}
        className={cn(
          "overflow-hidden rounded-md border border-border/60 bg-muted/40",
          fill ? "h-full w-full" : "shrink-0",
          className,
        )}
        style={fill ? undefined : { width: size, height: size }}
      >
        <div className="flex h-full w-full flex-col items-center justify-center gap-1">
          <Camera style={{ width: iconSize, height: iconSize }} className="text-muted-foreground/50" />
          <span className="text-[10px] font-medium text-muted-foreground/50">
            {caption ?? "No image"}
          </span>
        </div>
      </div>
    );
  }

  const hue = labelHue(label);
  const initial = label.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
  const fontSize = size <= 24 ? 9 : size <= 32 ? 10 : 12;
  return (
    <div
      aria-label={label}
      className={cn("shrink-0 overflow-hidden rounded-md", className)}
      style={{ width: size, height: size, background: `hsl(${hue}, 55%, 38%)` }}
    >
      <div className="flex h-full w-full items-center justify-center">
        <span className="select-none font-bold leading-none text-white" style={{ fontSize }}>
          {initial}
        </span>
      </div>
    </div>
  );
}

export function ProductThumb({
  src,
  label,
  size = 28,
  className,
  caption,
  fill,
}: {
  src?: string | null;
  label: string;
  size?: number;
  className?: string;
  caption?: string;
  /** When true, renders as w-full/h-full to fill its parent (parent must be position:relative with defined dimensions). */
  fill?: boolean;
}) {
  const [errored, setErrored] = useState(false);
  const trimmed = src?.trim();

  if (!trimmed || errored) {
    return <NoImagePlaceholder label={label} size={size} fill={fill} caption={caption} className={className} />;
  }

  if (fill) {
    return (
      <div className={cn("relative h-full w-full overflow-hidden", className)}>
        <Image src={trimmed} alt={label} fill className="object-cover" onError={() => setErrored(true)} />
      </div>
    );
  }

  return (
    <Image
      src={trimmed}
      alt={label}
      width={size}
      height={size}
      className={cn("shrink-0 rounded-md border border-border/60", className)}
      onError={() => setErrored(true)}
    />
  );
}

/**
 * Order-level thumbnail for table rows.
 * - 1 item  → single full-square colored initial (same as ProductThumb)
 * - 2+ items → 2×2 color-chip collage, each chip representing one SKU
 *
 * This avoids the misleading "single product image" for multi-item orders.
 */
export function OrderThumb({
  items,
  size = 40,
  className,
}: {
  items: Array<{ sku: { code: string } }>;
  size?: number;
  className?: string;
}) {
  if (items.length === 0) {
    return <ProductThumb label="?" size={size} className={className} />;
  }

  if (items.length === 1) {
    return <ProductThumb label={items[0].sku.code} size={size} className={className} />;
  }

  // Multi-item: 2×2 collage (up to 4 chips; 4th shows overflow count if needed)
  const chips = items.slice(0, 4);
  const overflow = items.length > 4 ? items.length - 3 : 0;

  return (
    <div
      aria-label={`Order with ${items.length} items`}
      className={cn("grid shrink-0 grid-cols-2 overflow-hidden rounded-md bg-border", className)}
      style={{ width: size, height: size, gap: 1 }}
    >
      {chips.map((item, i) => {
        const hue = labelHue(item.sku.code);
        const isOverflowCell = overflow > 0 && i === 3;
        return (
          <div
            key={i}
            className="flex items-center justify-center"
            style={{ background: isOverflowCell ? `hsl(0,0%,30%)` : `hsl(${hue},55%,38%)` }}
          >
            <span className="select-none font-bold leading-none text-white" style={{ fontSize: 9 }}>
              {isOverflowCell
                ? `+${overflow}`
                : item.sku.code.replace(/[^a-zA-Z0-9]/g, "").slice(0, 1).toUpperCase()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
