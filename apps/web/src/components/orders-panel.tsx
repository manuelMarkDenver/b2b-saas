"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";

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

const STATUS_LABELS: Record<Order["status"], string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_COLORS: Record<Order["status"], string> = {
  PENDING: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  CONFIRMED: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  COMPLETED: "bg-green-500/15 text-green-600 dark:text-green-400",
  CANCELLED: "bg-red-500/15 text-red-500",
};

const NEXT_STATUSES: Partial<Record<Order["status"], Order["status"][]>> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
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
  } catch {
    // ignore
  }
  try {
    const text = await res.text();
    if (text) return text;
  } catch {
    // ignore
  }
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
  const [status, setStatus] = React.useState<{ kind: "info" | "error"; text: string } | null>(null);

  const [selectedSkuId, setSelectedSkuId] = React.useState("");
  const [quantity, setQuantity] = React.useState(1);

  const { pushToast } = useToast();

  async function loadData() {
    setStatus({ kind: "info", text: "Loading orders..." });
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

      const ordersList = unwrapList<Order>(ordersData);
      const skusList = unwrapList<Sku>(skusData);

      setOrders(ordersList);
      setSkus(skusList.filter((s) => s.priceCents !== null));
      setStatus(null);
    } catch (err) {
      setStatus({
        kind: "error",
        text: err instanceof Error ? err.message : "Unable to load data",
      });
    }
  }

  React.useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  React.useEffect(() => {
    if (!selectedSkuId && skus.length > 0) {
      setSelectedSkuId(skus[0].id);
    }
  }, [skus, selectedSkuId]);

  async function createOrder() {
    if (!selectedSkuId) return;
    setStatus({ kind: "info", text: "Creating order..." });

    const res = await apiFetch("/orders", {
      tenantSlug,
      method: "POST",
      body: JSON.stringify({
        items: [{ skuId: selectedSkuId, quantity }],
      }),
    });

    if (!res.ok) {
      const msg = await readApiError(res);
      setStatus({
        kind: "error",
        text: `Create order failed: ${res.status}${msg ? ` (${msg})` : ""}`,
      });
      return;
    }

    setQuantity(1);
    pushToast({ variant: "success", title: "Order created", message: "" });
    await loadData();
  }

  async function updateStatus(orderId: string, newStatus: Order["status"]) {
    setStatus({ kind: "info", text: "Updating order..." });

    const res = await apiFetch(`/orders/${orderId}/status`, {
      tenantSlug,
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    });

    if (!res.ok) {
      const msg = await readApiError(res);
      setStatus({
        kind: "error",
        text: `Update failed: ${res.status}${msg ? ` (${msg})` : ""}`,
      });
      return;
    }

    pushToast({ variant: "success", title: "Order updated", message: newStatus });
    await loadData();
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Orders (Milestone 5)</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Create orders and manage status. Confirming an order deducts stock automatically.
          </div>
        </div>
        <button
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          onClick={loadData}
          type="button"
        >
          Refresh
        </button>
      </div>

      {status ? (
        <div className="mt-3">
          <Alert variant={status.kind === "error" ? "error" : "info"}>{status.text}</Alert>
        </div>
      ) : null}

      <div className="mt-5 rounded-md border border-border/60 p-4">
        <div className="text-sm font-medium">Create Order</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
            value={selectedSkuId}
            onChange={(e) => setSelectedSkuId(e.target.value)}
          >
            {skus.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name} ({formatCents(s.priceCents ?? 0)}, stock: {s.stockOnHand})
              </option>
            ))}
          </select>
          <input
            className="h-9 w-24 rounded-md border border-input bg-background px-3 text-sm"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
          />
          <button
            className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50"
            type="button"
            onClick={createOrder}
            disabled={!selectedSkuId || quantity < 1}
          >
            Create Order
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {orders.length === 0 ? (
          <div className="text-sm text-muted-foreground">No orders yet.</div>
        ) : null}
        {orders.map((order) => {
          const next = NEXT_STATUSES[order.status];
          return (
            <div
              key={order.id}
              className="rounded-md border border-border/60 bg-background p-4 text-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium font-mono text-xs text-muted-foreground">
                    {order.id.slice(0, 8)}…
                  </div>
                  <div className="mt-1 font-medium">{formatCents(order.totalCents)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                  {next && next.length > 0 ? (
                    <div className="flex gap-1">
                      {next.map((s) => (
                        <button
                          key={s}
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                          type="button"
                          onClick={() => updateStatus(order.id, s)}
                        >
                          → {STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {item.sku.code} · {item.sku.name} × {item.quantity}
                    </span>
                    <span>{formatCents(item.priceAtTime * item.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
