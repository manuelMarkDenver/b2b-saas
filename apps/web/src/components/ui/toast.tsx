"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type ToastVariant = "info" | "success" | "warning" | "error";

export type ToastItem = {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  toasts: ToastItem[];
  pushToast: (toast: Omit<ToastItem, "id">) => void;
  dismissToast: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

function toastClasses(variant: ToastVariant) {
  switch (variant) {
    case "success":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    case "warning":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    case "error":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    default:
      return "border-border bg-background text-foreground";
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = React.useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const item: ToastItem = { id, ...toast };
      setToasts((prev) => [item, ...prev].slice(0, 3));

      window.setTimeout(() => dismissToast(id), 4000);
    },
    [dismissToast],
  );

  return (
    <ToastContext.Provider value={{ toasts, pushToast, dismissToast }}>
      {children}
      <ToastViewport toasts={toasts} dismissToast={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

function ToastViewport({
  toasts,
  dismissToast,
}: {
  toasts: ToastItem[];
  dismissToast: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-3">
      <div className="flex w-full max-w-md flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto rounded-md border px-3 py-2 shadow-sm backdrop-blur",
              toastClasses(t.variant),
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {t.title ? <div className="text-sm font-medium">{t.title}</div> : null}
                <div className={cn("text-sm", t.title ? "mt-0.5" : "")}>{t.message}</div>
              </div>
              <button
                type="button"
                className="-mr-1 -mt-1 h-8 w-8 rounded-md border border-transparent text-xs opacity-70 hover:opacity-100"
                onClick={() => dismissToast(t.id)}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
