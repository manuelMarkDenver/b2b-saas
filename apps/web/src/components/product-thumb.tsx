"use client";

import Image from "next/image";
import { Camera } from "lucide-react";

import { cn } from "@/lib/utils";

/** Deterministic hue from a string so each label gets a consistent color. */
function labelHue(label: string): number {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
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
  const trimmed = src?.trim();

  if (!trimmed) {
    // Large thumbnails (detail sheets, product cards): camera icon + caption
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

    // Small thumbnails (table rows): deterministic colored initial — scannable at a glance
    const hue = labelHue(label);
    const initial = label.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
    const fontSize = size <= 24 ? 9 : size <= 32 ? 10 : 12;
    return (
      <div
        aria-label={label}
        className={cn("shrink-0 overflow-hidden rounded-md", className)}
        style={{
          width: size,
          height: size,
          background: `hsl(${hue}, 55%, 38%)`,
        }}
      >
        <div className="flex h-full w-full items-center justify-center">
          <span
            className="select-none font-bold leading-none text-white"
            style={{ fontSize }}
          >
            {initial}
          </span>
        </div>
      </div>
    );
  }

  if (fill) {
    return (
      <div className={cn("relative h-full w-full overflow-hidden", className)}>
        <Image src={trimmed} alt={label} fill className="object-cover" />
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
    />
  );
}
