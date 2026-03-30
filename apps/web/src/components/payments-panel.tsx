"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { ProductThumb } from "@/components/product-thumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

type Order = {
  id: string;
  status: string;
  totalCents: number;
  createdAt: string;
  /** Present on /orders responses; may be absent when embedded inside a Payment. */
  items?: Array<{
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

const PAYMENT_STATUS_LABELS: Record<Payment["status"], string> = {
  PENDING: "Pending",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

const PAYMENT_STATUS_VARIANT: Record<Payment["status"], "pending" | "verified" | "rejected"> = {
  PENDING: "pending",
  VERIFIED: "verified",
  REJECTED: "rejected",
};

const ORDER_STATUS_VARIANT: Record<string, "pending" | "confirmed" | "completed" | "cancelled"> = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

function formatCents(cents: number) {
  return `₱${(cents / 100).toFixed(2)}`;
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
  type Meta = { total: number; page: number; limit: number; totalPages: number };

  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [ordersMeta, setOrdersMeta] = React.useState<Meta>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [ordersPage, setOrdersPage] = React.useState(1);
  const [status, setStatus] = React.useState<{ kind: "info" | "error"; text: string } | null>(null);

  const [selectedOrderId, setSelectedOrderId] = React.useState("");
  const [amountDollars, setAmountDollars] = React.useState("0.00");
  const [proofUrl, setProofUrl] = React.useState("");
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const { pushToast } = useToast();

  async function loadData(oPage = ordersPage) {
    setStatus({ kind: "info", text: "Loading payments..." });
    try {
      const [paymentsRes, ordersRes] = await Promise.all([
        apiFetch("/payments", { tenantSlug }),
        apiFetch(`/orders?page=${oPage}&limit=20`, { tenantSlug }),
      ]);

      if (!paymentsRes.ok) throw new Error(`Payments failed: ${paymentsRes.status}`);
      if (!ordersRes.ok) throw new Error(`Orders failed: ${ordersRes.status}`);

      const [paymentsData, ordersData] = await Promise.all([
        paymentsRes.json() as Promise<unknown>,
        ordersRes.json() as Promise<unknown>,
      ]);

      const paymentsList = unwrapList<Payment>(paymentsData);
      const parsedOrders = ordersData as { data?: Order[]; meta?: Meta };
      const ordersList = parsedOrders.data ?? unwrapList<Order>(ordersData);
      if (parsedOrders.meta) setOrdersMeta(parsedOrders.meta);

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
    void loadData(ordersPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, ordersPage]);

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

  function openOrder(orderId: string) {
    handleOrderChange(orderId);
    setSheetOpen(true);
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
          <div className="text-sm font-medium">Payments</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Submit payments for orders. Staff verifies or rejects manually.
          </div>
        </div>
        <button
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          onClick={() => void loadData()}
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

      <Tabs defaultValue="payables" className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="payables">Payables</TabsTrigger>
            <TabsTrigger value="history">Payments</TabsTrigger>
          </TabsList>
          <div className="text-xs text-muted-foreground">
            Payables: {orders.length} · Payments: {payments.length}
          </div>
        </div>

        <TabsContent value="payables" className="mt-4">

      <div className="overflow-x-auto rounded-md border border-border/60">
        <div className="min-w-[640px]">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-background px-4 py-3">
          <div>
            <div className="text-sm font-medium">Orders</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Click an order to view details and submit payment.
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {orders.length} total
          </div>
        </div>

        <div className="grid grid-cols-[1fr_60px_120px_120px_160px_80px] gap-3 border-b border-border/60 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Order</span>
          <span className="text-center">Items</span>
          <span>Status</span>
          <span className="text-right">Total</span>
          <span>Created</span>
          <span className="text-right">Action</span>
        </div>

        <div className="divide-y divide-border/60">
          {orders.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => openOrder(o.id)}
              className="grid w-full grid-cols-[1fr_60px_120px_120px_160px_80px] items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/30"
            >
              <div className="min-w-0">
                <div className="font-mono text-xs font-semibold text-foreground">{o.id.slice(0, 8)}…</div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {o.items?.[0] ? `${o.items[0].sku.code} · ${o.items[0].sku.name}` : "No items"}
                  {(o.items?.length ?? 0) > 1 ? ` +${(o.items?.length ?? 0) - 1} more` : ""}
                  {pendingPaymentByOrderId.has(o.id) ? " · pending payment" : ""}
                </div>
              </div>

              <span className="text-center text-sm font-medium tabular-nums">{o.items?.length ?? 0}</span>

              <Badge variant={ORDER_STATUS_VARIANT[o.status] ?? "muted"} className="min-w-[90px] justify-center">
                {o.status}
              </Badge>

              <span className="text-right font-mono tabular-nums">{formatCents(o.totalCents)}</span>
              <span className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString()}</span>

              {o.status === "COMPLETED" || o.status === "CANCELLED" ? (
                <span className="text-right text-xs text-muted-foreground">View</span>
              ) : (
                <span className="ml-auto inline-flex items-center rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary ring-1 ring-primary/30">
                  Pay →
                </span>
              )}
            </button>
          ))}
        </div>
        </div>
        {ordersMeta.totalPages > 1 && (
          <Pagination
            page={ordersMeta.page}
            totalPages={ordersMeta.totalPages}
            total={ordersMeta.total}
            limit={ordersMeta.limit}
            onPage={(p) => setOrdersPage(p)}
            className="border-t border-border/60"
          />
        )}
      </div>

        </TabsContent>

        <TabsContent value="history" className="mt-4">

      <div className="overflow-x-auto rounded-md border border-border/60">
        <div className="min-w-[800px]">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-background px-4 py-3">
          <div>
            <div className="text-sm font-medium">Payments</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Review payment history. Pending payments can be verified or rejected.
            </div>
          </div>
          <div className="text-xs text-muted-foreground">{payments.length} total</div>
        </div>

        {payments.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">No payments yet.</div>
        ) : (
          <>
            <div className="grid grid-cols-[120px_110px_1fr_90px_1fr_120px_220px] gap-3 border-b border-border/60 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <span>Payment</span>
              <span className="text-right">Amount</span>
              <span>Order</span>
              <span>Proof</span>
              <span>Created</span>
              <span>Status</span>
              <span className="text-right">Action</span>
            </div>

            <div className="divide-y divide-border/60">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="grid grid-cols-[120px_110px_1fr_90px_1fr_120px_220px] items-center gap-3 px-4 py-3 text-sm"
                >
                  <span className="font-mono text-xs text-muted-foreground">{payment.id.slice(0, 8)}…</span>

                  <span className="text-right font-mono tabular-nums">{formatCents(payment.amountCents)}</span>

                  <div className="min-w-0">
                    <div className="truncate text-xs text-muted-foreground">
                      {payment.orderId.slice(0, 8)}…
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {payment.order.status}
                      {payment.order.items?.length
                        ? ` · ${payment.order.items.length} item${payment.order.items.length === 1 ? "" : "s"}`
                        : ""}
                    </div>
                  </div>

                  {payment.proofUrl ? (
                    <a
                      href={payment.proofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-fit text-xs text-primary underline"
                    >
                      View
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}

                  <span className="text-xs text-muted-foreground">{new Date(payment.createdAt).toLocaleString()}</span>

                  <Badge variant={PAYMENT_STATUS_VARIANT[payment.status]} className="min-w-[72px] justify-center">
                    {PAYMENT_STATUS_LABELS[payment.status]}
                  </Badge>

                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Button
                      variant="outline"
                      type="button"
                      className="h-8 px-3 text-xs"
                      onClick={() => openOrder(payment.orderId)}
                    >
                      View
                    </Button>

                    {payment.status === "PENDING" ? (
                      <>
                        <Button
                          type="button"
                          className="h-8 px-3 text-xs"
                          onClick={() => verifyPayment(payment.id, "VERIFIED")}
                        >
                          Verify
                        </Button>
                        <Button
                          variant="outline"
                          type="button"
                          className="h-8 px-3 text-xs border-destructive/60 text-destructive hover:bg-destructive/10"
                          onClick={() => verifyPayment(payment.id, "REJECTED")}
                        >
                          Reject
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        </div>
      </div>

        </TabsContent>
      </Tabs>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:w-[520px]">
          <SheetHeader>
            <SheetTitle>Order details</SheetTitle>
            <SheetDescription>Review items, then submit a payment for this order.</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 pb-28">
            {selectedOrder ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-border/60 bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Order</div>
                      <div className="mt-0.5 font-mono text-sm font-medium">{selectedOrder.id.slice(0, 8)}…</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Date(selectedOrder.createdAt).toLocaleString()}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {selectedOrder.items?.length ?? 0} item{(selectedOrder.items?.length ?? 0) === 1 ? "" : "s"}
                      </div>
                    </div>
                    <Badge variant={ORDER_STATUS_VARIANT[selectedOrder.status] ?? "muted"}>
                      {selectedOrder.status}
                    </Badge>
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-card p-4">
                  <div className="text-sm font-medium">Items</div>
                  <div className="mt-3 space-y-3">
                    {(selectedOrder.items ?? []).map((it) => (
                      <div key={it.id} className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <ProductThumb
                            label={`${it.sku.code} ${it.sku.name}`}
                            caption="No image"
                            size={96}
                            className="rounded-lg border border-border/60"
                          />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {it.sku.code} · {it.sku.name}
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">Qty {it.quantity}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm tabular-nums">
                            {formatCents(it.priceAtTime * it.quantity)}
                          </div>
                          <div className="text-xs text-muted-foreground">{formatCents(it.priceAtTime)} ea</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-card p-4">
                  <div className="text-sm font-medium">Payment details</div>
                  <div className="mt-3 space-y-2">
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
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-card p-4">
                  <div className="text-sm font-medium">Activity</div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Created/updated by will appear here once audit actors are exposed by the API.
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border/60 bg-card p-4 text-sm text-muted-foreground">
                Select an order from the list to view details.
              </div>
            )}
          </div>

          <div className="border-t border-border/60 bg-background/95 px-5 py-4 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="font-mono text-lg font-semibold tabular-nums">
                  {selectedOrder ? formatCents(selectedOrder.totalCents) : "—"}
                </div>
              </div>
              <button
                className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                type="button"
                onClick={submitPayment}
                disabled={!selectedOrderId || parseFloat(amountDollars) <= 0}
              >
                Submit Payment
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
