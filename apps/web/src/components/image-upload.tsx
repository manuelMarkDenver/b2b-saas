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
}

export function ImageUpload({
  currentUrl,
  tenantSlug,
  onUploaded,
  onRemoved,
  size = 80,
  className,
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

  return (
    <div className={cn('relative', className)} style={{ width: size, height: size }}>
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
        className="group relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/40 hover:border-primary/60 hover:bg-muted transition-colors"
        title="Click to upload image"
      >
        {currentUrl ? (
          <Image src={currentUrl} alt="SKU image" fill className="object-cover" />
        ) : (
          <Camera className="h-6 w-6 text-muted-foreground/50 group-hover:text-primary/60" />
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          ) : (
            <Camera className="h-5 w-5 text-white" />
          )}
        </div>
      </button>

      {/* Remove button */}
      {currentUrl && onRemoved && !uploading && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemoved(); }}
          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-background shadow-sm hover:bg-destructive hover:text-destructive-foreground"
          title="Remove image"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}

      {error && (
        <p className="absolute left-0 top-full mt-1 w-max max-w-[180px] rounded bg-destructive px-1.5 py-0.5 text-[10px] text-destructive-foreground">
          {error}
        </p>
      )}
    </div>
  );
}
