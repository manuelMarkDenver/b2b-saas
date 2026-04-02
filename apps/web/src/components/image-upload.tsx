'use client';

import * as React from 'react';
import Image from 'next/image';
import { Camera, Loader2, X } from 'lucide-react';
import { getToken } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  currentUrl?: string | null;
  tenantSlug: string;
  onUploaded: (url: string) => void;
  onRemoved?: () => void;
  size?: number;
  className?: string;
  /** "square" (default) for fixed-size, "dropzone" for full-width hero */
  variant?: "square" | "dropzone";
}

export function ImageUpload({
  currentUrl,
  tenantSlug,
  onUploaded,
  onRemoved,
  size = 80,
  className,
  variant = "square",
}: ImageUploadProps) {
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL;
      const form = new FormData();
      form.append('file', file);

      const res = await fetch(`${base}/uploads`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken() ?? ''}`, 'x-tenant-slug': tenantSlug },
        body: form,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        setError(data.message ?? 'Upload failed');
        return;
      }

      const { url } = await res.json() as { url: string };
      onUploaded(url);
    } catch {
      setError('Upload failed — please try again');
    } finally {
      setUploading(false);
    }
  }

  const isDropzone = variant === "dropzone";

  return (
    <div
      className={cn(
        'relative',
        isDropzone ? 'h-28 w-full' : '',
        className,
      )}
      style={isDropzone ? undefined : { width: size, height: size }}
    >
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />

      {/* Preview or placeholder */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={cn(
          'group relative flex items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/30 transition-colors',
          'hover:border-primary/50 hover:bg-muted/50',
          isDropzone ? 'h-full w-full flex-col gap-1.5' : 'h-full w-full',
        )}
        title="Click to upload image"
      >
        {currentUrl ? (
          <>
            <Image src={currentUrl} alt="Product image" fill className="object-cover" />
            {/* Hover overlay for dropzone with image */}
            {isDropzone && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                ) : (
                  <span className="text-sm font-medium text-white">Change photo</span>
                )}
              </div>
            )}
          </>
        ) : isDropzone ? (
          <>
            <Camera className="h-8 w-8 text-muted-foreground/60 group-hover:text-primary/70" />
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground/80 group-hover:text-foreground">
                Add product photo
              </p>
              <p className="text-xs text-muted-foreground/60">
                Click to upload
              </p>
            </div>
          </>
        ) : (
          <Camera className="h-6 w-6 text-muted-foreground/50 group-hover:text-primary/60" />
        )}

        {/* Hover overlay for square variant (no image) */}
        {!isDropzone && !currentUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            ) : (
              <Camera className="h-5 w-5 text-white" />
            )}
          </div>
        )}

        {/* Hover overlay for square variant (with image) */}
        {!isDropzone && currentUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            ) : (
              <Camera className="h-5 w-5 text-white" />
            )}
          </div>
        )}
      </button>

      {/* Remove button */}
      {currentUrl && onRemoved && !uploading && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemoved(); }}
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background shadow-sm hover:bg-destructive hover:text-destructive-foreground',
            isDropzone ? 'absolute right-2 top-2' : 'absolute -right-1.5 -top-1.5 h-4 w-4',
          )}
          title="Remove image"
        >
          <X className={isDropzone ? 'h-3 w-3' : 'h-2.5 w-2.5'} />
        </button>
      )}

      {error && (
        <p className={cn(
          'absolute w-max max-w-[180px] rounded bg-destructive px-1.5 py-0.5 text-[10px] text-destructive-foreground',
          isDropzone ? 'left-2 top-full mt-1' : 'left-0 top-full mt-1',
        )}>
          {error}
        </p>
      )}
    </div>
  );
}
