"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";

type Order = {
  id: string;
  status: string;
  totalCents: number;
  createdAt: string;
  items: Array<{
    id: string;
    quantity: number;
    priceAtTime: number;
    sku: { code: string; name: string };
  }>;
};

type Payment = {
  id: string;
  orderId: string;
  amountCents: number;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  proofUrl: string | null;
  createdAt: string;
  order: Order;
};

const STATUS_LABELS: Record<Payment["status"], string> = {
  PENDING: "Pending",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

const STATUS_COLORS: Record<Payment["status"], string> = {
  PENDING: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  VERIFIED: "bg-green-500/15 text-green-600 dark:text-green-400",
  REJECTED: "bg-red-500/15 text-red-500",
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  CONFIRMED: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  COMPLETED: "bg-green-500/15 text-green-600 dark:text-green-400",
  CANCELLED: "bg-red-500/15 text-red-500",
};

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatOrderLabel(order: Order) {
  const shortId = `${order.id.slice(0, 8)}…`;
  const date = new Date(order.createdAt);
  const when = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  return `${shortId} · ${order.status} · ${formatCents(order.totalCents)} · ${when}`;
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

export function PaymentsPanel({ tenantSlug }: { tenantSlug: string }) {
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [status, setStatus] = React.useState<{ kind: "info" | "error"; text: string } | null>(null);

  const [selectedOrderId, setSelectedOrderId] = React.useState("");
  const [amountDollars, setAmountDollars] = React.useState("0.00");
  const [proofUrl, setProofUrl] = React.useState("");

  const { pushToast } = useToast();

  async function loadData() {
    setStatus({ kind: "info", text: "Loading payments..." });
    try {
      const [paymentsRes, ordersRes] = await Promise.all([
        apiFetch("/payments", { tenantSlug }),
        apiFetch("/orders", { tenantSlug }),
      ]);

      if (!paymentsRes.ok) throw new Error(`Payments failed: ${paymentsRes.status}`);
      if (!ordersRes.ok) throw new Error(`Orders failed: ${ordersRes.status}`);

      const [paymentsData, ordersData] = await Promise.all([
        paymentsRes.json() as Promise<unknown>,
        ordersRes.json() as Promise<unknown>,
      ]);

      const paymentsList = unwrapList<Payment>(paymentsData);
      const ordersList = unwrapList<Order>(ordersData);

      setPayments(paymentsList);
      const payableOrders = ordersList
        .filter((o) => o.status !== "CANCELLED")
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(payableOrders);
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
    if (!selectedOrderId && orders.length > 0) {
      const preferred = orders.find((o) => o.status === "CONFIRMED" || o.status === "PENDING") ?? orders[0];
      setSelectedOrderId(preferred.id);
      setAmountDollars((preferred.totalCents / 100).toFixed(2));
    }
  }, [orders, selectedOrderId]);

  const selectedOrder = React.useMemo(
    () => orders.find((o) => o.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  const pendingPaymentByOrderId = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of payments) {
      if (p.status === "PENDING") set.add(p.orderId);
    }
    return set;
  }, [payments]);

  function handleOrderChange(orderId: string) {
    setSelectedOrderId(orderId);
    const order = orders.find((o) => o.id === orderId);
    if (order) setAmountDollars((order.totalCents / 100).toFixed(2));
  }

  async function submitPayment() {
    if (!selectedOrderId) return;
    setStatus({ kind: "info", text: "Submitting payment..." });

    const amountCents = Math.round(parseFloat(amountDollars) * 100);
    const res = await apiFetch("/payments", {
      tenantSlug,
      method: "POST",
      body: JSON.stringify({
        orderId: selectedOrderId,
        amountCents,
        ...(proofUrl.trim() ? { proofUrl: proofUrl.trim() } : {}),
      }),
    });

    if (!res.ok) {
      const msg = await readApiError(res);
      setStatus({
        kind: "error",
        text: `Submit payment failed: ${res.status}${msg ? ` (${msg})` : ""}`,
      });
      return;
    }

    setProofUrl("");
    pushToast({ variant: "success", title: "Payment submitted", message: "" });
    await loadData();
  }

  async function verifyPayment(paymentId: string, newStatus: "VERIFIED" | "REJECTED") {
    setStatus({ kind: "info", text: "Updating payment..." });

    const res = await apiFetch(`/payments/${paymentId}/verify`, {
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

    pushToast({ variant: "success", title: "Payment updated", message: newStatus });
    await loadData();
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Payments (Milestone 6)</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Submit payments for orders. Staff verifies or rejects manually.
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
        <div className="text-sm font-medium">Submit Payment</div>
        <div className="mt-3 space-y-2">
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={selectedOrderId}
            onChange={(e) => handleOrderChange(e.target.value)}
          >
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {formatOrderLabel(o)}{pendingPaymentByOrderId.has(o.id) ? " · pending payment" : ""}
              </option>
            ))}
          </select>

          {selectedOrder ? (
            <div className="rounded-md border border-border/60 bg-background px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  Order <span className="font-mono text-foreground">{selectedOrder.id.slice(0, 8)}…</span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    ORDER_STATUS_COLORS[selectedOrder.status] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  {selectedOrder.status}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-sm font-medium">{formatCents(selectedOrder.totalCents)}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(selectedOrder.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="mt-2 space-y-1">
                {selectedOrder.items.slice(0, 3).map((it) => (
                  <div key={it.id} className="flex justify-between text-xs text-muted-foreground">
                    <span className="truncate">
                      {it.sku.code} · {it.sku.name} × {it.quantity}
                    </span>
                    <span className="font-mono tabular-nums">{formatCents(it.priceAtTime * it.quantity)}</span>
                  </div>
                ))}
                {selectedOrder.items.length > 3 ? (
                  <div className="text-xs text-muted-foreground">+{selectedOrder.items.length - 3} more items</div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <input
              className="h-9 w-full rounded-md border border-input bg-background pl-6 pr-3 text-sm"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={amountDollars}
              onChange={(e) => setAmountDollars(e.target.value)}
            />
          </div>
          <input
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="Proof URL (optional)"
            value={proofUrl}
            onChange={(e) => setProofUrl(e.target.value)}
          />
          <button
            className="h-9 w-full rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50"
            type="button"
            onClick={submitPayment}
            disabled={!selectedOrderId || parseFloat(amountDollars) <= 0}
          >
            Submit Payment
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {payments.length === 0 ? (
          <div className="text-sm text-muted-foreground">No payments yet.</div>
        ) : null}
        {payments.map((payment) => (
          <div
            key={payment.id}
            className="rounded-md border border-border/60 bg-background p-4 text-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-xs text-muted-foreground">
                  {payment.id.slice(0, 8)}…
                </div>
                <div className="mt-1 font-medium">{formatCents(payment.amountCents)}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Order: {payment.orderId.slice(0, 8)}… · {payment.order.status}
                </div>
                {payment.proofUrl ? (
                  <a
                    href={payment.proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block text-xs text-primary underline"
                  >
                    View proof
                  </a>
                ) : (
                  <div className="mt-1 text-xs text-muted-foreground">No proof attached</div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[payment.status]}`}>
                  {STATUS_LABELS[payment.status]}
                </span>
                {payment.status === "PENDING" ? (
                  <div className="flex gap-1">
                    <button
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                      type="button"
                      onClick={() => verifyPayment(payment.id, "VERIFIED")}
                    >
                      ✓ Verify
                    </button>
                    <button
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                      type="button"
                      onClick={() => verifyPayment(payment.id, "REJECTED")}
                    >
                      ✕ Reject
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
