"use client";

import * as React from "react";
import { Minus, Plus, X, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatCents } from "@/lib/format";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { ProductThumb } from "@/components/product-thumb";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar, FilterValues } from "@/components/ui/filter-bar";
import { DateRangePicker, presetToRange, type DateRange } from "@/components/dashboard/date-range-picker";
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
  imageUrl?: string | null;
  priceCents: number | null;
  stockOnHand: number;
  lowStockThreshold?: number;
};

type OrderItem = {
  id: string;
  skuId: string;
  quantity: number;
  priceAtTime: number;
  sku: { id: string; code: string; name: string; imageUrl?: string | null };
};

type OrderPayment = {
  id: string;
  amountCents: number;
  method: string;
  createdAt: string;
};

type Order = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  totalCents: number;
  paidCents?: number;
  balanceCents?: number;
  createdAt: string;
  paymentDueDate?: string | null;
  customerRef?: string | null;
  items: OrderItem[];
  payments?: OrderPayment[];
};

type CartLine = { skuId: string; quantity: number };

type Contact = {
  id: string;
  name: string;
  type: "CUSTOMER" | "DISTRIBUTOR";
  creditLimitCents: number;
};

type ContactAr = {
  balanceCents: number;
  creditLimitCents: number;
};

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

type Meta = { total: number; page: number; limit: number; totalPages: number };

export function OrdersPanel({ tenantSlug }: { tenantSlug: string }) {
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [meta, setMeta] = React.useState<Meta>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [page, setPage] = React.useState(1);
  const [filters, setFilters] = React.useState<FilterValues>({});
  const [dateRange, setDateRange] = React.useState<DateRange>(() => presetToRange('30d'));
  const [sortKey, setSortKey] = React.useState<'createdAt' | 'totalCents' | 'status'>('createdAt');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const [skus, setSkus] = React.useState<Sku[]>([]);
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<string>('');
  const [customerType, setCustomerType] = React.useState<'walkin' | 'existing' | 'new'>('walkin');
  const [customerSearch, setCustomerSearch] = React.useState('');
  const [customerSearchFocused, setCustomerSearchFocused] = React.useState(false);
  const [newCustomerName, setNewCustomerName] = React.useState('');
  const [newCustomerPhone, setNewCustomerPhone] = React.useState('');
  const [newCustomerType, setNewCustomerType] = React.useState<'CUSTOMER' | 'DISTRIBUTOR'>('CUSTOMER');
  const [newCustomerCreditLimit, setNewCustomerCreditLimit] = React.useState('');
  const [pageStatus, setPageStatus] = React.useState<{ kind: "info" | "error"; text: string } | null>(null);

  // New Order sheet
  const [newOrderOpen, setNewOrderOpen] = React.useState(false);
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [orderView, setOrderView] = React.useState<"products" | "cart">("products");
  const [search, setSearch] = React.useState("");

  // Order detail sheet
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);

  // Payment recording
  const [payOpen, setPayOpen] = React.useState(false);
  const [payAmount, setPayAmount] = React.useState('');
  const [payMethod, setPayMethod] = React.useState('CASH');
  const [payLoading, setPayLoading] = React.useState(false);

  // Edit mode (within detail sheet, PENDING only)
  const [editMode, setEditMode] = React.useState(false);
  const [editCart, setEditCart] = React.useState<CartLine[]>([]);
  const [editView, setEditView] = React.useState<"products" | "cart">("products");

  // Payment terms feature flag
  const [hasPaymentTerms, setHasPaymentTerms] = React.useState(false);
  const [paymentDueDate, setPaymentDueDate] = React.useState('');

  // Credit limit check for existing customer
  const [contactAr, setContactAr] = React.useState<ContactAr | null>(null);
  const [contactArLoading, setContactArLoading] = React.useState(false);

  React.useEffect(() => {
    apiFetch(`/auth/me`, { tenantSlug })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.tenant) {
          const features = (data.tenant as { features?: Record<string, boolean> }).features;
          setHasPaymentTerms(features?.paymentTerms === true);
        }
      })
      .catch(() => {});
  }, [tenantSlug]);

  React.useEffect(() => {
    if (customerType !== 'existing' || !selectedCustomerId) {
      setContactAr(null);
      return;
    }
    setContactArLoading(true);
    apiFetch(`/contacts/${selectedCustomerId}/ar`, { tenantSlug })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          const contact = data.contact as { creditLimitCents?: number };
          setContactAr({
            balanceCents: data.balanceCents as number,
            creditLimitCents: contact.creditLimitCents ?? 0,
          });
        }
      })
      .catch(() => {})
      .finally(() => setContactArLoading(false));
  }, [selectedCustomerId, customerType, tenantSlug]);

  const [editSearch, setEditSearch] = React.useState("");

  const { pushToast } = useToast();

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  }

  const filteredContacts = React.useMemo(() => {
    if (!customerSearch.trim()) return contacts;
    const q = customerSearch.toLowerCase();
    return contacts.filter((c) => c.name.toLowerCase().includes(q));
  }, [contacts, customerSearch]);

  async function loadData(p = page, f = filters, dr = dateRange) {
    setPageStatus({ kind: "info", text: "Loading orders..." });
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (f.search) params.set('search', f.search as string);
      if (f.status) params.set('status', f.status as string);
      params.set('from', dr.from);
      params.set('to', dr.to);
      if (f.minAmount) params.set('minCents', String(Math.round(parseFloat(f.minAmount as string) * 100)));
      if (f.maxAmount) params.set('maxCents', String(Math.round(parseFloat(f.maxAmount as string) * 100)));
      if (f.hasTerms) params.set('hasTerms', f.hasTerms as string);
      const [ordersRes, skusRes, contactsRes] = await Promise.all([
        apiFetch(`/orders?${params}`, { tenantSlug }),
        apiFetch("/skus", { tenantSlug }),
        apiFetch("/contacts", { tenantSlug }),
      ]);
      if (!ordersRes.ok) throw new Error(`Orders failed: ${ordersRes.status}`);
      if (!skusRes.ok) throw new Error(`SKUs failed: ${skusRes.status}`);
      const [ordersData, skusData, contactsData] = await Promise.all([
        ordersRes.json() as Promise<unknown>,
        skusRes.json() as Promise<unknown>,
        contactsRes.json() as Promise<unknown>,
      ]);
      const parsed = ordersData as { data?: Order[]; meta?: Meta };
      setOrders(parsed.data ?? unwrapList<Order>(ordersData));
      if (parsed.meta) setMeta(parsed.meta);
      setSkus(unwrapList<Sku>(skusData).filter((s) => s.priceCents !== null));
      setContacts(unwrapList<Contact>(contactsData));
      setPageStatus(null);
    } catch (err) {
      setPageStatus({ kind: "error", text: err instanceof Error ? err.message : "Unable to load data" });
    }
  }

  const sortedOrders = React.useMemo(() => {
    return [...orders].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'createdAt') return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      if (sortKey === 'totalCents') return dir * (a.totalCents - b.totalCents);
      if (sortKey === 'status') return dir * a.status.localeCompare(b.status);
      return 0;
    });
  }, [orders, sortKey, sortDir]);

  React.useEffect(() => {
    void loadData(page, filters, dateRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, page, filters, dateRange]);

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
    setSelectedCustomerId("");
    setCustomerType('walkin');
    setCustomerSearch('');
    setCustomerSearchFocused(false);
    setNewCustomerName('');
    setNewCustomerPhone('');
    setNewCustomerType('CUSTOMER');
    setNewCustomerCreditLimit('');
    setPaymentDueDate('');
    setContactAr(null);
    setNewOrderOpen(true);
  }

  async function placeOrder() {
    if (cart.length === 0) return;
    setPageStatus({ kind: "info", text: "Creating order..." });

    let contactId = selectedCustomerId;
    let customerRef = '';

    if (customerType === 'walkin') {
      customerRef = 'Walk-in';
    } else if (customerType === 'existing') {
      if (!selectedCustomerId) {
        setPageStatus({ kind: "error", text: "Please select a customer or choose Walk-in" });
        return;
      }
      const contact = contacts.find((c) => c.id === selectedCustomerId);
      customerRef = contact?.name ?? '';
    } else if (customerType === 'new') {
      if (!newCustomerName.trim()) {
        setPageStatus({ kind: "error", text: "Customer name is required" });
        return;
      }
      const contactBody: Record<string, unknown> = {
        name: newCustomerName.trim(),
        type: newCustomerType,
      };
      if (newCustomerPhone.trim()) contactBody.phone = newCustomerPhone.trim();
      if (newCustomerCreditLimit) contactBody.creditLimitCents = Math.round(parseFloat(newCustomerCreditLimit) * 100);

      const res = await apiFetch("/contacts", {
        tenantSlug,
        method: "POST",
        body: JSON.stringify(contactBody),
      });
      if (!res.ok) {
        const msg = await readApiError(res);
        setPageStatus({ kind: "error", text: `Create customer failed: ${res.status}${msg ? ` (${msg})` : ""}` });
        return;
      }
      const newContact = await res.json() as { id: string; name: string };
      contactId = newContact.id;
      customerRef = newContact.name;
    }

    const body: { items: { skuId: string; quantity: number }[]; contactId?: string; customerRef: string; paymentDueDate?: string } = {
      items: cart.map((l) => ({ skuId: l.skuId, quantity: l.quantity })),
      customerRef,
    };
    if (contactId) body.contactId = contactId;
    if (paymentDueDate && hasPaymentTerms) body.paymentDueDate = paymentDueDate;

    const res = await apiFetch("/orders", {
      tenantSlug,
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const msg = await readApiError(res);
      setPageStatus({ kind: "error", text: `Create order failed: ${res.status}${msg ? ` (${msg})` : ""}` });
      return;
    }
    setNewOrderOpen(false);
    setCart([]);
    setCustomerType('walkin');
    setSelectedCustomerId('');
    setNewCustomerName('');
    setNewCustomerPhone('');
    setNewCustomerType('CUSTOMER');
    setNewCustomerCreditLimit('');
    pushToast({ variant: "success", title: "Order created", message: customerRef !== 'Walk-in' ? customerRef : "" });
    await loadData();
  }

  // ── Edit mode helpers ─────────────────────────────────────────────────────────

  const filteredEditSkus = React.useMemo(
    () =>
      skus.filter(
        (s) =>
          editSearch.trim() === "" ||
          s.code.toLowerCase().includes(editSearch.toLowerCase()) ||
          s.name.toLowerCase().includes(editSearch.toLowerCase()),
      ),
    [skus, editSearch],
  );

  function editCartQtyFor(skuId: string) {
    return editCart.find((l) => l.skuId === skuId)?.quantity ?? 0;
  }

  function editAddOne(skuId: string) {
    setEditCart((prev) => {
      const ex = prev.find((l) => l.skuId === skuId);
      if (ex) return prev.map((l) => (l.skuId === skuId ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { skuId, quantity: 1 }];
    });
  }

  function setEditLineQty(skuId: string, qty: number) {
    if (qty < 1) { setEditCart((prev) => prev.filter((l) => l.skuId !== skuId)); return; }
    setEditCart((prev) => prev.map((l) => (l.skuId === skuId ? { ...l, quantity: qty } : l)));
  }

  const editCartTotalCents = editCart.reduce((sum, line) => {
    const sku = skus.find((s) => s.id === line.skuId);
    return sum + (sku?.priceCents ?? 0) * line.quantity;
  }, 0);

  const editCartItemCount = editCart.reduce((n, l) => n + l.quantity, 0);

  function enterEditMode() {
    if (!selectedOrder) return;
    setEditCart(selectedOrder.items.map((item) => ({ skuId: item.skuId, quantity: item.quantity })));
    setEditView("products");
    setEditSearch("");
    setEditMode(true);
  }

  function exitEditMode() {
    setEditMode(false);
  }

  async function saveOrderEdit() {
    if (!selectedOrder || editCart.length === 0) return;
    const res = await apiFetch(`/orders/${selectedOrder.id}`, {
      tenantSlug,
      method: "PATCH",
      body: JSON.stringify({ items: editCart.map((l) => ({ skuId: l.skuId, quantity: l.quantity })) }),
    });
    if (!res.ok) {
      const msg = await readApiError(res);
      setPageStatus({ kind: "error", text: `Update failed: ${res.status}${msg ? ` (${msg})` : ""}` });
      return;
    }
    setEditMode(false);
    setDetailOpen(false);
    pushToast({ variant: "success", title: "Order updated", message: "" });
    await loadData();
  }

  // ── Order detail ──────────────────────────────────────────────────────────────

  function openDetail(order: Order) {
    setSelectedOrder(order);
    setDetailOpen(true);
    setPayOpen(false);
    setPayAmount('');
    setPayMethod('CASH');
  }

  async function handleRecordPayment() {
    if (!selectedOrder) return;
    const cents = Math.round(parseFloat(payAmount) * 100);
    if (!cents || cents <= 0) return;
    setPayLoading(true);
    const res = await apiFetch(`/orders/${selectedOrder.id}/pay`, {
      tenantSlug,
      method: 'POST',
      body: JSON.stringify({ amountCents: cents, method: payMethod }),
    });
    if (res.ok) {
      const data = await res.json();
      setSelectedOrder((o) => o ? { ...o, paidCents: data.paidCents, balanceCents: data.balanceCents, payments: [...(o.payments ?? []), data.payment] } : o);
      setPayOpen(false);
      setPayAmount('');
      pushToast({ variant: 'success', title: 'Payment recorded', message: `Balance: ₱${(data.balanceCents / 100).toFixed(2)}` });
      await loadData();
    } else {
      const d = await res.json().catch(() => ({}));
      pushToast({ variant: 'error', title: 'Payment failed', message: d.message ?? 'Something went wrong' });
    }
    setPayLoading(false);
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

  function handleExport() {
    const rows: string[][] = [['Order ID', 'Status', 'Total', 'Items', 'Created']];
    orders.forEach((o) => {
      rows.push([
        o.id,
        o.status,
        formatCents(o.totalCents),
        String(o.items.reduce((n, i) => n + i.quantity, 0)),
        new Date(o.createdAt).toLocaleDateString(),
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'orders.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      {/* ── Panel header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Orders</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Create and manage orders. Confirming deducts stock automatically.
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            onClick={() => void loadData()}
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

      {/* ── Filter bar ── */}
      <div className="mt-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker value={dateRange} onChange={(r) => { setDateRange(r); setPage(1); }} />
        </div>
        <FilterBar
          filters={[
            { type: 'search', key: 'search', placeholder: 'Search order ID or customer ref…' },
            {
              type: 'select', key: 'status', label: 'All statuses',
              options: [
                { value: 'PENDING', label: 'Pending' },
                { value: 'CONFIRMED', label: 'Confirmed' },
                { value: 'COMPLETED', label: 'Completed' },
                { value: 'CANCELLED', label: 'Cancelled' },
              ],
            },
            { type: 'number', key: 'minAmount', placeholder: '₱ Min', min: 0 },
            { type: 'number', key: 'maxAmount', placeholder: '₱ Max', min: 0 },
            {
              type: 'select', key: 'hasTerms', label: 'All types',
              options: [
                { value: 'true', label: 'Terms orders' },
                { value: 'false', label: 'COD orders' },
              ],
            },
          ]}
          values={filters}
          onChange={(v) => { setFilters(v); setPage(1); }}
          onExport={handleExport}
        />
      </div>

      {pageStatus ? (
        <div className="mt-3">
          <Alert variant={pageStatus.kind === "error" ? "error" : "info"}>{pageStatus.text}</Alert>
        </div>
      ) : null}

      {/* ── Orders table ── */}
      <div className="mt-5 overflow-x-auto rounded-md border border-border/60">
        <div className="min-w-[640px]">
        <div className="grid grid-cols-[1fr_60px_120px_120px_160px_100px] gap-3 border-b border-border/60 bg-background px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Order</span>
          <span className="text-center">Items</span>
          <button type="button" onClick={() => toggleSort('status')} className="flex items-center gap-1 hover:text-foreground">
            Status {sortKey === 'status' ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
          </button>
          <button type="button" onClick={() => toggleSort('totalCents')} className="flex items-center justify-end gap-1 hover:text-foreground">
            {sortKey === 'totalCents' ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-40" />} Total
          </button>
          <button type="button" onClick={() => toggleSort('createdAt')} className="flex items-center gap-1 hover:text-foreground">
            Created {sortKey === 'createdAt' ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
          </button>
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
            {sortedOrders.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => openDetail(order)}
                className="grid w-full grid-cols-[1fr_60px_120px_120px_160px_100px] items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/30"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-semibold text-foreground">{order.id.slice(0, 8)}…</span>
                    {order.paymentDueDate && (() => {
                      const isOverdue = new Date(order.paymentDueDate) < new Date();
                      return (
                        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${isOverdue ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                          {isOverdue ? 'Overdue' : 'Terms'}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {order.customerRef ? `${order.customerRef} · ` : ''}
                    {order.items[0]
                      ? `${order.items[0].sku.code} · ${order.items[0].sku.name}`
                      : "No items"}
                    {order.items.length > 1 ? ` +${order.items.length - 1} more` : ""}
                  </div>
                </div>

                <span className="text-center text-sm font-medium tabular-nums">{order.items.reduce((sum, i) => sum + i.quantity, 0)}</span>

                <Badge variant={STATUS_VARIANT[order.status]} className="min-w-[80px] justify-center">
                  {STATUS_LABELS[order.status]}
                </Badge>

                <span className="text-right font-mono tabular-nums">{formatCents(order.totalCents)}</span>
                <span className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</span>

                {order.status === "COMPLETED" || order.status === "CANCELLED" ? (
                  <span className="text-right text-xs text-muted-foreground">{ACTION_LABEL[order.status]}</span>
                ) : (
                  <span className="ml-auto inline-flex items-center rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary ring-1 ring-primary/30">
                    {ACTION_LABEL[order.status]}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        </div>
        {meta.totalPages > 1 && (
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            limit={meta.limit}
            onPage={(p) => setPage(p)}
            className="border-t border-border/60"
          />
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          NEW ORDER SHEET — two-view: Products ↔ Cart
      ────────────────────────────────────────────────────────────────────────── */}
      <Sheet open={newOrderOpen} onOpenChange={setNewOrderOpen}>
        <SheetContent side="right" className="w-full sm:w-[680px]">
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
                  <div className="grid grid-cols-3 gap-2">
                    {filteredSkus.map((sku) => {
                      const qty = cartQtyFor(sku.id);
                      const inCart = qty > 0;
                      return (
                        <div
                          key={sku.id}
                          className={`overflow-hidden rounded-lg border bg-card transition-colors ${inCart ? "border-primary/60" : "border-border/60"}`}
                        >
                          {/* Image — shorter on compact view */}
                          <div className="relative h-24 w-full bg-muted/20">
                            <ProductThumb
                              fill
                              src={sku.imageUrl}
                              label={`${sku.code} ${sku.name}`}
                              className="absolute inset-0 rounded-none border-0"
                            />
                            {inCart ? (
                              <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow">
                                {qty}
                              </div>
                            ) : null}
                          </div>

                          {/* Info */}
                          <div className="p-2">
                            <div className="text-[10px] font-medium text-muted-foreground leading-none">{sku.code}</div>
                            <div className="mt-0.5 line-clamp-2 text-xs font-semibold leading-snug">{sku.name}</div>
                            <div className="mt-1 text-sm font-bold text-primary tabular-nums">
                              {formatCents(sku.priceCents ?? 0)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Total stock: {sku.stockOnHand}
                              {(sku.lowStockThreshold ?? 0) > 0 && sku.stockOnHand <= (sku.lowStockThreshold ?? 0) && (
                                <span className="ml-1 text-amber-600 font-medium">· Low stock globally</span>
                              )}
                            </div>

                            {/* Controls */}
                            {inCart ? (
                              <div className="mt-1.5 flex items-center justify-between gap-0.5">
                                <button
                                  type="button"
                                  className="flex h-7 w-7 items-center justify-center rounded-md border border-input bg-background"
                                  onClick={() => setLineQty(sku.id, qty - 1)}
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="flex-1 text-center text-sm font-bold tabular-nums">{qty}</span>
                                <button
                                  type="button"
                                  className="flex h-7 w-7 items-center justify-center rounded-md border border-input bg-background"
                                  onClick={() => setLineQty(sku.id, qty + 1)}
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="mt-1.5 w-full rounded-md border border-primary/60 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
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
              <div className="sticky top-0 z-10 border-b border-border/60 bg-background/95 px-5 pt-4 pb-3 backdrop-blur">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Customer</label>
                  <select
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    value={customerType}
                    onChange={(e) => {
                      setCustomerType(e.target.value as 'walkin' | 'existing' | 'new');
                      if (e.target.value === 'walkin') {
                        setSelectedCustomerId('');
                        setCustomerSearch('');
                      }
                    }}
                  >
                    <option value="walkin">Walk-in</option>
                    <option value="existing">Existing Customer</option>
                    <option value="new">New Customer</option>
                  </select>

                  {customerType === 'existing' && (
                    <>
                      <input
                        type="search"
                        placeholder="Search customer..."
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={customerSearch}
                        onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomerId(''); setContactAr(null); }}
                        onFocus={() => setCustomerSearchFocused(true)}
                        onBlur={() => setTimeout(() => setCustomerSearchFocused(false), 150)}
                      />
                      {(customerSearchFocused || customerSearch.trim()) && (
                        <div className="max-h-40 overflow-y-auto rounded-md border border-border/60 bg-background">
                          {filteredContacts.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-muted-foreground">No customers found</div>
                          ) : (
                            filteredContacts.slice(0, 10).map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                                onClick={() => { setSelectedCustomerId(c.id); setCustomerSearch(c.name); setCustomerSearchFocused(false); }}
                              >
                                {c.name} <span className="text-xs text-muted-foreground">({c.type === 'DISTRIBUTOR' ? 'Distributor' : 'Customer'})</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {customerType === 'new' && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Name *"
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                      />
                      <input
                        type="tel"
                        placeholder="Phone (for collections)"
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <select
                          className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                          value={newCustomerType}
                          onChange={(e) => setNewCustomerType(e.target.value as 'CUSTOMER' | 'DISTRIBUTOR')}
                        >
                          <option value="CUSTOMER">Customer</option>
                          <option value="DISTRIBUTOR">Distributor</option>
                        </select>
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₱</span>
                          <input
                            type="number"
                            min={0}
                            step={100}
                            placeholder="Credit limit"
                            className="h-9 w-full rounded-md border border-input bg-background pl-6 pr-3 text-sm"
                            value={newCustomerCreditLimit}
                            onChange={(e) => setNewCustomerCreditLimit(e.target.value)}
                          />
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Credit limit = 0 means COD only. Set a limit to allow terms orders.</p>
                    </div>
                  )}
                </div>

                {hasPaymentTerms && customerType !== 'walkin' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Payment Due Date <span className="text-muted-foreground/60">(terms)</span></label>
                    <input
                      type="date"
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                      value={paymentDueDate}
                      onChange={(e) => setPaymentDueDate(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-36">
                <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
                  {cart.map((line) => {
                    const sku = skus.find((s) => s.id === line.skuId);
                    if (!sku) return null;
                    return (
                      <div key={line.skuId} className="flex items-center gap-4 px-4 py-4">
                        <ProductThumb
                          src={sku.imageUrl}
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
                            <input
                              type="number"
                              min={1}
                              className="w-14 rounded-md border border-input bg-background px-1 py-1 text-center text-base font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                              value={line.quantity}
                              onChange={(e) => setLineQty(line.skuId, Math.max(1, parseInt(e.target.value) || 1))}
                            />
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
                {/* Credit limit indicator */}
                {contactAr && contactAr.creditLimitCents > 0 && (() => {
                  const remaining = contactAr.creditLimitCents - contactAr.balanceCents;
                  const wouldExceed = cartTotalCents > remaining;
                  return (
                    <div className={`mb-3 rounded-lg px-3 py-2 text-xs ${wouldExceed ? 'bg-destructive/10 text-destructive' : 'bg-muted/60 text-muted-foreground'}`}>
                      {wouldExceed ? (
                        <>
                          <span className="font-semibold">Credit limit exceeded.</span>{' '}
                          Remaining: {formatCents(remaining)} · This order: {formatCents(cartTotalCents)} · Over by {formatCents(cartTotalCents - remaining)}
                        </>
                      ) : (
                        <>Credit remaining: <span className="font-semibold">{formatCents(remaining)}</span> of {formatCents(contactAr.creditLimitCents)}</>
                      )}
                    </div>
                  );
                })()}
                {contactArLoading && (
                  <div className="mb-3 text-xs text-muted-foreground">Checking credit...</div>
                )}
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
      <Sheet open={detailOpen} onOpenChange={(open) => { setDetailOpen(open); if (!open) setEditMode(false); }}>
        <SheetContent side="right" className="w-full sm:w-[680px]">
          <SheetHeader>
            <SheetTitle>
              {editMode ? "Edit Order" : `Order ${selectedOrder?.id.slice(0, 8)}…`}
            </SheetTitle>
            <SheetDescription>
              {editMode
                ? "Change items or quantities. Only PENDING orders can be edited."
                : selectedOrder
                  ? `${new Date(selectedOrder.createdAt).toLocaleString()} · ${selectedOrder.items.reduce((sum, i) => sum + i.quantity, 0)} item${selectedOrder.items.reduce((sum, i) => sum + i.quantity, 0) === 1 ? "" : "s"}`
                  : ""}
            </SheetDescription>
          </SheetHeader>

          {/* ── VIEW MODE ── */}
          {!editMode && selectedOrder ? (
            <>
              <div className="flex-1 overflow-y-auto px-5 pb-28">
                <div className="space-y-4">
                  {/* Status + summary + edit button */}
                  <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Total</div>
                      <div className="mt-0.5 text-2xl font-bold tabular-nums">
                        {formatCents(selectedOrder.totalCents)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={STATUS_VARIANT[selectedOrder.status]} className="min-w-[90px] justify-center text-sm">
                        {STATUS_LABELS[selectedOrder.status]}
                      </Badge>
                      {selectedOrder.status === "PENDING" ? (
                        <button
                          type="button"
                          className="h-9 rounded-lg border border-primary/60 px-4 text-sm font-semibold text-primary hover:bg-primary/10"
                          onClick={enterEditMode}
                        >
                          Edit order
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Items */}
                  <div className="rounded-xl border border-border/60 bg-card">
                    <div className="border-b border-border/60 px-4 py-3 text-sm font-semibold">Items</div>
                    <div className="divide-y divide-border/60 px-4">
                      {selectedOrder.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-4 py-4">
                          <ProductThumb src={item.sku.imageUrl} label={`${item.sku.code} ${item.sku.name}`} size={80} className="rounded-xl" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold">{item.sku.code}</div>
                            <div className="text-sm text-muted-foreground">{item.sku.name}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Qty {item.quantity} · {formatCents(item.priceAtTime)} ea
                            </div>
                          </div>
                          <div className="text-base font-bold tabular-nums">
                            {formatCents(item.priceAtTime * item.quantity)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payments */}
                  <div className="rounded-xl border border-border/60 bg-card">
                    <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                      <span className="text-sm font-semibold">Payments</span>
                      {selectedOrder.status !== 'CANCELLED' && (
                        <button
                          type="button"
                          className="text-xs font-medium text-primary hover:underline"
                          onClick={() => setPayOpen((v) => !v)}
                        >
                          {payOpen ? 'Cancel' : '+ Record payment'}
                        </button>
                      )}
                    </div>

                    {payOpen && (
                      <div className="border-b border-border/60 p-4 space-y-3">
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Amount (₱)"
                            className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                          />
                          <select
                            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            value={payMethod}
                            onChange={(e) => setPayMethod(e.target.value)}
                          >
                            <option value="CASH">Cash</option>
                            <option value="GCASH">GCash</option>
                            <option value="MAYA">Maya</option>
                            <option value="BANK_TRANSFER">Bank Transfer</option>
                            <option value="CARD">Card</option>
                            <option value="CHEQUE">Cheque</option>
                          </select>
                          <button
                            type="button"
                            disabled={payLoading || !payAmount}
                            onClick={handleRecordPayment}
                            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                          >
                            {payLoading ? '…' : 'Save'}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="divide-y divide-border/60 px-4">
                      {(selectedOrder.payments ?? []).length === 0 ? (
                        <p className="py-3 text-xs text-muted-foreground">No payments recorded.</p>
                      ) : (
                        (selectedOrder.payments ?? []).map((p) => (
                          <div key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                            <span className="text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()} · {p.method}</span>
                            <span className="font-medium text-green-700 dark:text-green-400">{formatCents(p.amountCents)}</span>
                          </div>
                        ))
                      )}
                    </div>

                    {(selectedOrder.totalCents > 0) && (
                      <div className="border-t border-border/60 px-4 py-3 space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Paid</span>
                          <span className="text-green-700 dark:text-green-400 font-medium">{formatCents(selectedOrder.paidCents ?? 0)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-semibold">
                          <span>Balance</span>
                          <span className={(selectedOrder.balanceCents ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}>
                            {formatCents(selectedOrder.balanceCents ?? selectedOrder.totalCents)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* View footer — status actions */}
              <div className="border-t border-border/60 bg-background/95 px-5 py-5 backdrop-blur">
                {(() => {
                  const next = NEXT_STATUSES[selectedOrder.status];
                  if (!next || next.length === 0) {
                    return <p className="text-center text-sm text-muted-foreground">No further actions available.</p>;
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
            </>
          ) : null}

          {/* ── EDIT MODE — same two-view pattern as New Order ── */}
          {editMode ? (
            <>
              {editView === "products" ? (
                <>
                  <div className="px-5 pb-3">
                    <input
                      type="search"
                      placeholder="Search by name or SKU code…"
                      value={editSearch}
                      onChange={(e) => setEditSearch(e.target.value)}
                      className="h-10 w-full rounded-lg border border-input bg-background px-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {filteredEditSkus.length !== skus.length ? (
                      <div className="mt-1.5 text-xs text-muted-foreground">
                        {filteredEditSkus.length} of {skus.length} products
                      </div>
                    ) : null}
                  </div>

                  <div className="flex-1 overflow-y-auto px-5 pb-36">
                    {filteredEditSkus.length === 0 ? (
                      <div className="py-16 text-center text-sm text-muted-foreground">No products match &ldquo;{editSearch}&rdquo;</div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {filteredEditSkus.map((sku) => {
                          const qty = editCartQtyFor(sku.id);
                          const inCart = qty > 0;
                          return (
                            <div key={sku.id} className={`overflow-hidden rounded-lg border bg-card transition-colors ${inCart ? "border-primary/60" : "border-border/60"}`}>
                              <div className="relative h-24 w-full bg-muted/20">
                                <ProductThumb fill src={sku.imageUrl} label={`${sku.code} ${sku.name}`} className="absolute inset-0 rounded-none border-0" />
                                {inCart ? (
                                  <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow">{qty}</div>
                                ) : null}
                              </div>
                              <div className="p-2">
                                <div className="text-[10px] font-medium text-muted-foreground leading-none">{sku.code}</div>
                                <div className="mt-0.5 line-clamp-2 text-xs font-semibold leading-snug">{sku.name}</div>
                                <div className="mt-1 text-sm font-bold text-primary tabular-nums">{formatCents(sku.priceCents ?? 0)}</div>
                            <div className="text-[10px] text-muted-foreground">
                              Total stock: {sku.stockOnHand}
                              {(sku.lowStockThreshold ?? 0) > 0 && sku.stockOnHand <= (sku.lowStockThreshold ?? 0) && (
                                <span className="ml-1 text-amber-600 font-medium">· Low stock globally</span>
                              )}
                            </div>
                                {inCart ? (
                                  <div className="mt-1.5 flex items-center justify-between gap-0.5">
                                    <button type="button" className="flex h-7 w-7 items-center justify-center rounded-md border border-input bg-background" onClick={() => setEditLineQty(sku.id, qty - 1)}><Minus className="h-3 w-3" /></button>
                                    <span className="flex-1 text-center text-sm font-bold tabular-nums">{qty}</span>
                                    <button type="button" className="flex h-7 w-7 items-center justify-center rounded-md border border-input bg-background" onClick={() => setEditLineQty(sku.id, qty + 1)}><Plus className="h-3 w-3" /></button>
                                  </div>
                                ) : (
                                  <button type="button" className="mt-1.5 w-full rounded-md border border-primary/60 py-1 text-xs font-semibold text-primary hover:bg-primary/10" onClick={() => editAddOne(sku.id)}>+ Add</button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border/60 bg-background/95 px-5 py-5 backdrop-blur">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">
                          {editCartItemCount === 0 ? "No items yet" : `${editCartItemCount} item${editCartItemCount === 1 ? "" : "s"} in cart`}
                        </div>
                        <div className="mt-0.5 text-3xl font-bold tabular-nums">{formatCents(editCartTotalCents)}</div>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" className="h-12 rounded-xl border border-input bg-background px-4 text-sm font-semibold hover:bg-muted/40" onClick={exitEditMode}>Cancel</button>
                        <button type="button" className="h-12 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground disabled:opacity-40" onClick={() => setEditView("cart")} disabled={editCart.length === 0}>Review →</button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto px-5 pb-36">
                    <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
                      {editCart.map((line) => {
                        const sku = skus.find((s) => s.id === line.skuId);
                        if (!sku) return null;
                        return (
                          <div key={line.skuId} className="flex items-center gap-4 px-4 py-4">
                            <ProductThumb src={sku.imageUrl} label={`${sku.code} ${sku.name}`} size={80} className="rounded-xl" />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold">{sku.code}</div>
                              <div className="text-sm text-muted-foreground">{sku.name}</div>
                              <div className="mt-0.5 text-xs text-muted-foreground">{formatCents(sku.priceCents ?? 0)} ea</div>
                              <div className="mt-2 flex items-center gap-2">
                                <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-input bg-background" onClick={() => setEditLineQty(line.skuId, line.quantity - 1)}><Minus className="h-3.5 w-3.5" /></button>
                                <input type="number" min={1} className="w-14 rounded-md border border-input bg-background px-1 py-1 text-center text-base font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-ring" value={line.quantity} onChange={(e) => setEditLineQty(line.skuId, Math.max(1, parseInt(e.target.value) || 1))} />
                                <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-input bg-background" onClick={() => setEditLineQty(line.skuId, line.quantity + 1)}><Plus className="h-3.5 w-3.5" /></button>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <div className="text-base font-bold tabular-nums">{formatCents((sku.priceCents ?? 0) * line.quantity)}</div>
                              <button type="button" className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => setEditLineQty(line.skuId, 0)}><X className="h-4 w-4" /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-border/60 bg-background/95 px-5 py-5 backdrop-blur">
                    <div className="flex items-center justify-between gap-4">
                      <button type="button" className="h-12 rounded-xl border border-input bg-background px-5 text-sm font-semibold hover:bg-muted/40" onClick={() => setEditView("products")}>← Add More</button>
                      <div className="flex flex-col items-end">
                        <div className="text-sm text-muted-foreground">{editCartItemCount} item{editCartItemCount === 1 ? "" : "s"}</div>
                        <div className="text-2xl font-bold tabular-nums">{formatCents(editCartTotalCents)}</div>
                      </div>
                      <button type="button" className="h-12 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground" onClick={saveOrderEdit}>Save Changes</button>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
