"use client";

import Image from "next/image";
import { Camera } from "lucide-react";

import { cn } from "@/lib/utils";

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
    const iconSize = fill ? 28 : size >= 80 ? 22 : 16;
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
          <Camera style={{ width: iconSize, height: iconSize }} className="text-muted-foreground/60" />
          {(fill || size >= 64) ? (
            <span className="text-[10px] font-medium text-muted-foreground/60">
              {caption ?? "No image"}
            </span>
          ) : null}
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
