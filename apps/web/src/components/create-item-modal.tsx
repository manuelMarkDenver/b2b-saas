"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { ImageUpload } from "@/components/image-upload";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Category = { id: string; name: string; slug: string };

interface CreateItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantSlug: string;
  categories: Category[];
  onCreated: () => void;
  /** Optional pre-selected category */
  defaultCategoryId?: string;
}

export function CreateItemModal({
  open,
  onOpenChange,
  tenantSlug,
  categories,
  onCreated,
  defaultCategoryId,
}: CreateItemModalProps) {
  const { pushToast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [autoSkuCode, setAutoSkuCode] = React.useState("");
  const [overrideSku, setOverrideSku] = React.useState(false);
  const [customSkuCode, setCustomSkuCode] = React.useState("");
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = React.useState({
    categoryId: defaultCategoryId ?? "",
    name: "",
    costCents: "",
    priceCents: "",
    lowStockThreshold: "",
    initialQty: "",
    note: "",
    imageUrl: "",
  });

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      const catId = defaultCategoryId ?? (categories[0]?.id ?? "");
      setForm({
        categoryId: catId,
        name: "",
        costCents: "",
        priceCents: "",
        lowStockThreshold: "",
        initialQty: "",
        note: "",
        imageUrl: "",
      });
      setAutoSkuCode("");
      setOverrideSku(false);
      setCustomSkuCode("");
      if (catId) fetchAutoSku(catId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onCategoryChange(categoryId: string) {
    setForm((f) => ({ ...f, categoryId }));
    if (!overrideSku) {
      fetchAutoSku(categoryId);
    }
  }

  function fetchAutoSku(categoryId: string) {
    setAutoSkuCode("...");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await apiFetch(`/skus/next-code?categoryId=${categoryId}`, { tenantSlug });
      if (res.ok) {
        const d = (await res.json()) as { code: string };
        setAutoSkuCode(d.code ?? "");
      }
    }, 300);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        categoryId: form.categoryId,
        name: form.name,
      };
      if (overrideSku && customSkuCode.trim()) body.code = customSkuCode.trim();
      if (form.costCents) body.costCents = Math.round(parseFloat(form.costCents) * 100);
      if (form.priceCents) body.priceCents = Math.round(parseFloat(form.priceCents) * 100);
      if (form.lowStockThreshold) body.lowStockThreshold = parseInt(form.lowStockThreshold, 10);
      if (form.initialQty) body.initialQty = parseInt(form.initialQty, 10);
      if (form.note) body.note = form.note;
      if (form.imageUrl) body.imageUrl = form.imageUrl;

      const res = await apiFetch("/products/with-stock", {
        method: "POST",
        tenantSlug,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        pushToast({ variant: "error", title: "Failed", message: err.message ?? "Unknown error" });
        return;
      }

      pushToast({ variant: "success", title: "Item created", message: form.name });
      onOpenChange(false);
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Hero Image - centered square */}
          <div className="mx-auto flex justify-center">
            <ImageUpload
              currentUrl={form.imageUrl || null}
              tenantSlug={tenantSlug}
              size={180}
              resourceType="sku-image"
              onUploaded={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
              onRemoved={() => setForm((f) => ({ ...f, imageUrl: "" }))}
            />
          </div>

          {/* Divider */}
          <div className="border-t border-border/60" />
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={form.categoryId} onValueChange={onCategoryChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Product name</Label>
            <Input
              placeholder="e.g. Chicken Wings 1kg"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>

          {form.categoryId && (
            <div className="space-y-2 rounded-md bg-muted/50 px-3 py-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  SKU Code
                </p>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overrideSku}
                    onChange={(e) => {
                      setOverrideSku(e.target.checked);
                      if (!e.target.checked) fetchAutoSku(form.categoryId);
                    }}
                    className="h-3.5 w-3.5 rounded border-input"
                  />
                  Override
                </label>
              </div>
              {overrideSku ? (
                <Input
                  placeholder="Enter custom SKU code"
                  value={customSkuCode}
                  onChange={(e) => setCustomSkuCode(e.target.value)}
                  className="font-mono text-sm"
                />
              ) : (
                <p className="font-mono text-sm font-semibold">{autoSkuCode || "\u2014"}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cost (P)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={form.costCents}
                onChange={(e) => setForm((f) => ({ ...f, costCents: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Price (P)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={form.priceCents}
                onChange={(e) => setForm((f) => ({ ...f, priceCents: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Low stock threshold</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={form.lowStockThreshold}
                onChange={(e) => setForm((f) => ({ ...f, lowStockThreshold: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Initial stock qty</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={form.initialQty}
                onChange={(e) => setForm((f) => ({ ...f, initialQty: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !form.categoryId || !form.name || (overrideSku && !customSkuCode.trim())}
            >
              {saving ? "Creating..." : "Create Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
