"use client";

import * as React from "react";
import { Minus, Plus, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { ProductThumb } from "@/components/product-thumb";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

type Sku = {
  id: string;
  code: string;
  name: string;
  priceCents: number | null;
  stockOnHand: number;
};

type OrderItem = {
  id: string;
  skuId: string;
  quantity: number;
  priceAtTime: number;
  sku: { id: string; code: string; name: string };
};

type Order = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  totalCents: number;
  createdAt: string;
  items: OrderItem[];
};

type CartLine = { skuId: string; quantity: number };

const STATUS_LABELS: Record<Order["status"], string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_VARIANT: Record<Order["status"], "pending" | "confirmed" | "completed" | "cancelled"> = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

const NEXT_STATUSES: Partial<Record<Order["status"], Order["status"][]>> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
};

const ACTION_LABEL: Record<Order["status"], string> = {
  PENDING: "Review →",
  CONFIRMED: "Fulfill →",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

async function readApiError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as unknown;
    if (
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof (data as { message?: unknown }).message === "string"
    ) {
      return (data as { message: string }).message;
    }
  } catch { /* ignore */ }
  try {
    const text = await res.text();
    if (text) return text;
  } catch { /* ignore */ }
  return "";
}

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (
    typeof payload === "object" &&
    payload !== null &&
    "data" in payload &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: T[] }).data;
  }
  return [];
}

export function OrdersPanel({ tenantSlug }: { tenantSlug: string }) {
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [skus, setSkus] = React.useState<Sku[]>([]);
  const [pageStatus, setPageStatus] = React.useState<{ kind: "info" | "error"; text: string } | null>(null);

  // New Order sheet
  const [newOrderOpen, setNewOrderOpen] = React.useState(false);
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [orderView, setOrderView] = React.useState<"products" | "cart">("products");
  const [search, setSearch] = React.useState("");

  // Order detail sheet
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);

  const { pushToast } = useToast();

  async function loadData() {
    setPageStatus({ kind: "info", text: "Loading orders..." });
    try {
      const [ordersRes, skusRes] = await Promise.all([
        apiFetch("/orders", { tenantSlug }),
        apiFetch("/skus", { tenantSlug }),
      ]);
      if (!ordersRes.ok) throw new Error(`Orders failed: ${ordersRes.status}`);
      if (!skusRes.ok) throw new Error(`SKUs failed: ${skusRes.status}`);
      const [ordersData, skusData] = await Promise.all([
        ordersRes.json() as Promise<unknown>,
        skusRes.json() as Promise<unknown>,
      ]);
      setOrders(unwrapList<Order>(ordersData));
      setSkus(unwrapList<Sku>(skusData).filter((s) => s.priceCents !== null));
      setPageStatus(null);
    } catch (err) {
      setPageStatus({ kind: "error", text: err instanceof Error ? err.message : "Unable to load data" });
    }
  }

  React.useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  // ── Cart helpers ─────────────────────────────────────────────────────────────

  function cartQtyFor(skuId: string) {
    return cart.find((l) => l.skuId === skuId)?.quantity ?? 0;
  }

  function addOne(skuId: string) {
    setCart((prev) => {
      const ex = prev.find((l) => l.skuId === skuId);
      if (ex) return prev.map((l) => (l.skuId === skuId ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { skuId, quantity: 1 }];
    });
  }

  function setLineQty(skuId: string, qty: number) {
    if (qty < 1) { setCart((prev) => prev.filter((l) => l.skuId !== skuId)); return; }
    setCart((prev) => prev.map((l) => (l.skuId === skuId ? { ...l, quantity: qty } : l)));
  }

  const cartTotalCents = cart.reduce((sum, line) => {
    const sku = skus.find((s) => s.id === line.skuId);
    return sum + (sku?.priceCents ?? 0) * line.quantity;
  }, 0);

  const cartItemCount = cart.reduce((n, l) => n + l.quantity, 0);

  const filteredSkus = React.useMemo(
    () =>
      skus.filter(
        (s) =>
          search.trim() === "" ||
          s.code.toLowerCase().includes(search.toLowerCase()) ||
          s.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [skus, search],
  );

  function openNewOrder() {
    setCart([]);
    setSearch("");
    setOrderView("products");
    setNewOrderOpen(true);
  }

  async function placeOrder() {
    if (cart.length === 0) return;
    setPageStatus({ kind: "info", text: "Creating order..." });
    const res = await apiFetch("/orders", {
      tenantSlug,
      method: "POST",
      body: JSON.stringify({ items: cart.map((l) => ({ skuId: l.skuId, quantity: l.quantity })) }),
    });
    if (!res.ok) {
      const msg = await readApiError(res);
      setPageStatus({ kind: "error", text: `Create order failed: ${res.status}${msg ? ` (${msg})` : ""}` });
      return;
    }
    setNewOrderOpen(false);
    setCart([]);
    pushToast({ variant: "success", title: "Order created", message: "" });
    await loadData();
  }

  // ── Order detail ──────────────────────────────────────────────────────────────

  function openDetail(order: Order) {
    setSelectedOrder(order);
    setDetailOpen(true);
  }

  async function updateStatus(orderId: string, newStatus: Order["status"]) {
    const res = await apiFetch(`/orders/${orderId}/status`, {
      tenantSlug,
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      const msg = await readApiError(res);
      setPageStatus({ kind: "error", text: `Update failed: ${res.status}${msg ? ` (${msg})` : ""}` });
      return;
    }
    pushToast({ variant: "success", title: "Order updated", message: STATUS_LABELS[newStatus] });
    setDetailOpen(false);
    await loadData();
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      {/* ── Panel header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Orders (Milestone 5)</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Create and manage orders. Confirming deducts stock automatically.
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            onClick={loadData}
            type="button"
          >
            Refresh
          </button>
          <button
            className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            type="button"
            onClick={openNewOrder}
          >
            + New Order
          </button>
        </div>
      </div>

      {pageStatus ? (
        <div className="mt-3">
          <Alert variant={pageStatus.kind === "error" ? "error" : "info"}>{pageStatus.text}</Alert>
        </div>
      ) : null}

      {/* ── Orders table ── */}
      <div className="mt-5 overflow-hidden rounded-md border border-border/60">
        <div className="grid grid-cols-[1fr_80px_120px_120px_1fr_100px] gap-3 border-b border-border/60 bg-background px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Order</span>
          <span className="text-center">Items</span>
          <span>Status</span>
          <span className="text-right">Total</span>
          <span>Created</span>
          <span className="text-right">Action</span>
        </div>

        {orders.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="text-sm font-medium text-muted-foreground">No orders yet</div>
            <div className="mt-3">
              <button
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                type="button"
                onClick={openNewOrder}
              >
                + New Order
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {orders.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => openDetail(order)}
                className="grid w-full grid-cols-[1fr_80px_120px_120px_1fr_100px] items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/30"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <ProductThumb label={order.items[0]?.sku.code ?? order.id.slice(0, 4)} size={40} className="rounded-lg" />
                  <div className="min-w-0">
                    <div className="truncate font-medium font-mono text-xs">{order.id.slice(0, 8)}…</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {order.items[0]
                        ? `${order.items[0].sku.code} · ${order.items[0].sku.name}`
                        : "No items"}
                      {order.items.length > 1 ? ` · +${order.items.length - 1} more` : ""}
                    </div>
                  </div>
                </div>

                <span className="text-center text-xs text-muted-foreground">{order.items.length}</span>

                <Badge variant={STATUS_VARIANT[order.status]} className="min-w-[80px] justify-center">
                  {STATUS_LABELS[order.status]}
                </Badge>

                <span className="text-right font-mono tabular-nums">{formatCents(order.totalCents)}</span>
                <span className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</span>

                <span className={`text-right text-xs font-medium ${order.status === "COMPLETED" || order.status === "CANCELLED" ? "text-muted-foreground" : "text-primary"}`}>
                  {ACTION_LABEL[order.status]}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          NEW ORDER SHEET — two-view: Products ↔ Cart
      ────────────────────────────────────────────────────────────────────────── */}
      <Sheet open={newOrderOpen} onOpenChange={setNewOrderOpen}>
        <SheetContent side="right" className="w-[680px]">
          <SheetHeader>
            <SheetTitle>
              {orderView === "products" ? "New Order" : "Review Cart"}
            </SheetTitle>
            <SheetDescription>
              {orderView === "products"
                ? "Browse and add products. Your cart is saved as you go."
                : `${cartItemCount} item${cartItemCount === 1 ? "" : "s"} · review before placing.`}
            </SheetDescription>
          </SheetHeader>

          {/* ── PRODUCTS VIEW ── */}
          {orderView === "products" ? (
            <>
              {/* Sticky search bar */}
              <div className="px-5 pb-3">
                <input
                  type="search"
                  placeholder="Search by name or SKU code…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {filteredSkus.length !== skus.length ? (
                  <div className="mt-1.5 text-xs text-muted-foreground">
                    {filteredSkus.length} of {skus.length} products
                  </div>
                ) : null}
              </div>

              {/* Product grid — takes all scrollable space */}
              <div className="flex-1 overflow-y-auto px-5 pb-36">
                {filteredSkus.length === 0 ? (
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    No products match &ldquo;{search}&rdquo;
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {filteredSkus.map((sku) => {
                      const qty = cartQtyFor(sku.id);
                      const inCart = qty > 0;
                      return (
                        <div
                          key={sku.id}
                          className={`overflow-hidden rounded-xl border bg-card transition-colors ${inCart ? "border-primary/60" : "border-border/60"}`}
                        >
                          {/* Square image */}
                          <div className="relative aspect-square w-full bg-muted/20">
                            <ProductThumb
                              fill
                              label={`${sku.code} ${sku.name}`}
                              className="absolute inset-0 rounded-none border-0"
                            />
                            {inCart ? (
                              <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow">
                                {qty}
                              </div>
                            ) : null}
                          </div>

                          {/* Info */}
                          <div className="p-3">
                            <div className="text-[11px] font-medium text-muted-foreground">{sku.code}</div>
                            <div className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug">{sku.name}</div>
                            <div className="mt-1.5 text-base font-bold text-primary">
                              {formatCents(sku.priceCents ?? 0)}
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">Stock: {sku.stockOnHand}</div>

                            {/* Controls */}
                            {inCart ? (
                              <div className="mt-3 flex items-center justify-between gap-1">
                                <button
                                  type="button"
                                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-background"
                                  onClick={() => setLineQty(sku.id, qty - 1)}
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <span className="flex-1 text-center text-base font-bold tabular-nums">{qty}</span>
                                <button
                                  type="button"
                                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-background"
                                  onClick={() => setLineQty(sku.id, qty + 1)}
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="mt-3 w-full rounded-lg border border-primary/60 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
                                onClick={() => addOne(sku.id)}
                              >
                                + Add
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Products footer */}
              <div className="border-t border-border/60 bg-background/95 px-5 py-5 backdrop-blur">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">
                      {cartItemCount === 0 ? "No items yet" : `${cartItemCount} item${cartItemCount === 1 ? "" : "s"} in cart`}
                    </div>
                    <div className="mt-0.5 text-3xl font-bold tabular-nums">
                      {formatCents(cartTotalCents)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="h-12 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground disabled:opacity-40"
                    onClick={() => setOrderView("cart")}
                    disabled={cart.length === 0}
                  >
                    Review Cart →
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* ── CART VIEW ── */
            <>
              <div className="flex-1 overflow-y-auto px-5 pb-36">
                <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
                  {cart.map((line) => {
                    const sku = skus.find((s) => s.id === line.skuId);
                    if (!sku) return null;
                    return (
                      <div key={line.skuId} className="flex items-center gap-4 px-4 py-4">
                        <ProductThumb
                          label={`${sku.code} ${sku.name}`}
                          size={80}
                          className="rounded-xl"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold">{sku.code}</div>
                          <div className="text-sm text-muted-foreground">{sku.name}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {formatCents(sku.priceCents ?? 0)} ea
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-input bg-background"
                              onClick={() => setLineQty(line.skuId, line.quantity - 1)}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-10 text-center text-base font-bold tabular-nums">{line.quantity}</span>
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-input bg-background"
                              onClick={() => setLineQty(line.skuId, line.quantity + 1)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-base font-bold tabular-nums">
                            {formatCents((sku.priceCents ?? 0) * line.quantity)}
                          </div>
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setLineQty(line.skuId, 0)}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cart footer */}
              <div className="border-t border-border/60 bg-background/95 px-5 py-5 backdrop-blur">
                <div className="flex items-center justify-between gap-4">
                  <button
                    type="button"
                    className="h-12 rounded-xl border border-input bg-background px-5 text-sm font-semibold hover:bg-muted/40"
                    onClick={() => setOrderView("products")}
                  >
                    ← Add More
                  </button>
                  <div className="flex flex-col items-end">
                    <div className="text-sm text-muted-foreground">{cartItemCount} item{cartItemCount === 1 ? "" : "s"}</div>
                    <div className="text-2xl font-bold tabular-nums">{formatCents(cartTotalCents)}</div>
                  </div>
                  <button
                    type="button"
                    className="h-12 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground"
                    onClick={placeOrder}
                  >
                    Place Order
                  </button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ──────────────────────────────────────────────────────────────────────────
          ORDER DETAIL SHEET
      ────────────────────────────────────────────────────────────────────────── */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-[520px]">
          <SheetHeader>
            <SheetTitle>Order {selectedOrder?.id.slice(0, 8)}…</SheetTitle>
            <SheetDescription>
              {selectedOrder
                ? `${new Date(selectedOrder.createdAt).toLocaleString()} · ${selectedOrder.items.length} item${selectedOrder.items.length === 1 ? "" : "s"}`
                : ""}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 pb-28">
            {selectedOrder ? (
              <div className="space-y-4">
                {/* Status + summary */}
                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Total</div>
                    <div className="mt-0.5 text-2xl font-bold tabular-nums">
                      {formatCents(selectedOrder.totalCents)}
                    </div>
                  </div>
                  <Badge variant={STATUS_VARIANT[selectedOrder.status]} className="min-w-[90px] justify-center text-sm">
                    {STATUS_LABELS[selectedOrder.status]}
                  </Badge>
                </div>

                {/* Items */}
                <div className="rounded-xl border border-border/60 bg-card">
                  <div className="border-b border-border/60 px-4 py-3 text-sm font-semibold">Items</div>
                  <div className="divide-y divide-border/60 px-4">
                    {selectedOrder.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 py-4">
                        <ProductThumb
                          label={`${item.sku.code} ${item.sku.name}`}
                          size={80}
                          className="rounded-xl"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold">{item.sku.code}</div>
                          <div className="text-sm text-muted-foreground">{item.sku.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Qty {item.quantity} · {formatCents(item.priceAtTime)} ea
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-base font-bold tabular-nums">
                            {formatCents(item.priceAtTime * item.quantity)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Detail footer — status actions */}
          {selectedOrder ? (
            <div className="border-t border-border/60 bg-background/95 px-5 py-5 backdrop-blur">
              {(() => {
                const next = NEXT_STATUSES[selectedOrder.status];
                if (!next || next.length === 0) {
                  return (
                    <p className="text-center text-sm text-muted-foreground">
                      No further actions available for this order.
                    </p>
                  );
                }
                return (
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Update status</div>
                    <div className="flex gap-2">
                      {next.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={`flex-1 rounded-xl py-3 text-sm font-semibold transition-colors ${
                            s === "CANCELLED"
                              ? "border border-destructive/60 text-destructive hover:bg-destructive/10"
                              : "bg-primary text-primary-foreground hover:bg-primary/90"
                          }`}
                          onClick={() => updateStatus(selectedOrder.id, s)}
                        >
                          → {STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
