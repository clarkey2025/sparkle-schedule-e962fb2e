import { useState, useMemo } from "react";
import { useApp } from "@/lib/AppContext";
import { formatCurrency, formatDate, getNextDueDate, FREQUENCY_LABELS } from "@/lib/helpers";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Plus, Search, Trash2, Pencil, MapPin, Phone, Mail,
  CalendarCheck, AlertTriangle, CheckCircle2, ChevronRight,
  Clock, PoundSterling, FileText, ArrowRight, Receipt,
} from "lucide-react";
import type { Customer } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const emptyForm = {
  name: "", address: "", phone: "", email: "",
  frequency: "monthly" as Customer["frequency"],
  pricePerClean: 0, notes: "",
};

type SortKey = "name" | "lastClean" | "outstanding" | "nextDue";
type FilterKey = "all" | "overdue" | "upcoming" | "clear";

// Initials avatar
function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  // Deterministic hue from name
  const hue = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
      style={{ backgroundColor: `hsl(${hue} 30% 18%)`, color: `hsl(${hue} 60% 65%)` }}
    >
      {initials || "?"}
    </div>
  );
}

// Status pill
function DueBadge({ daysOverdue, daysUntil }: { daysOverdue?: number; daysUntil?: number }) {
  if (daysOverdue !== undefined && daysOverdue > 0) {
    return (
      <span className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        daysOverdue > 14 ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"
      )}>
        <AlertTriangle className="h-2.5 w-2.5" />
        {daysOverdue}d late
      </span>
    );
  }
  if (daysUntil !== undefined) {
    if (daysUntil === 0) return <span className="inline-flex items-center gap-1 rounded bg-primary/15 text-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"><Clock className="h-2.5 w-2.5" />Today</span>;
    if (daysUntil <= 7) return <span className="inline-flex items-center gap-1 rounded bg-primary/10 text-primary/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"><Clock className="h-2.5 w-2.5" />In {daysUntil}d</span>;
    return <span className="inline-flex items-center gap-1 rounded bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"><CheckCircle2 className="h-2.5 w-2.5" />In {daysUntil}d</span>;
  }
  return null;
}

export default function CustomersPage() {
  const { customers, jobs, payments, addCustomer, updateCustomer, deleteCustomer } = useApp();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceCustomer, setInvoiceCustomer] = useState<Customer | null>(null);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Enrich each customer with computed data
  const enriched = useMemo(() => {
    return customers.map((c) => {
      const customerJobs = jobs.filter((j) => j.customerId === c.id);
      const completedJobs = customerJobs.filter((j) => j.status === "completed");
      const lastJob = [...completedJobs].sort((a, b) => b.date.localeCompare(a.date))[0];
      const nextDue = getNextDueDate(lastJob?.date, c.frequency);
      const daysOverdue = Math.round((now.getTime() - nextDue.getTime()) / (1000 * 60 * 60 * 24));
      const daysUntil = -daysOverdue;
      const totalCharged = completedJobs.reduce((s, j) => s + j.price, 0);
      const totalPaid = payments.filter((p) => p.customerId === c.id).reduce((s, p) => s + p.amount, 0);
      const outstanding = Math.max(0, totalCharged - totalPaid);
      return { customer: c, lastJob, nextDue, daysOverdue, daysUntil, totalCharged, totalPaid, outstanding };
    });
  }, [customers, jobs, payments]);

  // Filter
  const filtered = useMemo(() => {
    let list = enriched.filter(({ customer: c }) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.address.toLowerCase().includes(search.toLowerCase())
    );
    if (filter === "overdue") list = list.filter(({ daysOverdue }) => daysOverdue > 0);
    if (filter === "upcoming") list = list.filter(({ daysUntil }) => daysUntil >= 0 && daysUntil <= 7);
    if (filter === "clear") list = list.filter(({ outstanding }) => outstanding === 0);
    // Sort
    list = [...list].sort((a, b) => {
      if (sort === "name") return a.customer.name.localeCompare(b.customer.name);
      if (sort === "lastClean") return (b.lastJob?.date ?? "").localeCompare(a.lastJob?.date ?? "");
      if (sort === "outstanding") return b.outstanding - a.outstanding;
      if (sort === "nextDue") return a.nextDue.getTime() - b.nextDue.getTime();
      return 0;
    });
    return list;
  }, [enriched, search, filter, sort]);

  const totalOutstanding = enriched.reduce((s, { outstanding }) => s + outstanding, 0);
  const overdueCount = enriched.filter(({ daysOverdue }) => daysOverdue > 0).length;

  const openAdd = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, address: c.address, phone: c.phone, email: c.email, frequency: c.frequency, pricePerClean: c.pricePerClean, notes: c.notes });
    setDialogOpen(true);
  };
  const handleSave = () => {
    if (!form.name.trim()) return;
    editing ? updateCustomer(editing.id, form) : addCustomer(form);
    setDialogOpen(false);
  };

  const sendInvoice = (c: Customer, amount: number) => {
    setInvoiceCustomer(c);
    setInvoiceDialogOpen(true);
    setSelectedCustomer(null);
  };

  const confirmInvoice = () => {
    setInvoiceDialogOpen(false);
    toast({
      title: "Invoice sent via SumUp",
      description: `${invoiceCustomer?.name} has been sent an invoice for ${formatCurrency(enriched.find((e) => e.customer.id === invoiceCustomer?.id)?.outstanding ?? 0)}.`,
    });
  };

  // Selected customer enriched data
  const sel = selectedCustomer ? enriched.find((e) => e.customer.id === selectedCustomer.id) : null;
  const selJobs = selectedCustomer ? jobs.filter((j) => j.customerId === selectedCustomer.id).sort((a, b) => b.date.localeCompare(a.date)) : [];
  const selPayments = selectedCustomer ? payments.filter((p) => p.customerId === selectedCustomer.id).sort((a, b) => b.date.localeCompare(a.date)) : [];

  return (
    <div className="pb-24 md:pb-0">
      <PageHeader
        title="Customers"
        action={
          <Button onClick={openAdd} size="sm">
            <Plus className="h-3.5 w-3.5" /> Add Customer
          </Button>
        }
      />

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3 mb-5 animate-fade-up stagger-1">
        {[
          { label: "Total Customers", value: String(customers.length), icon: CheckCircle2, colour: "text-foreground" },
          { label: "Overdue Cleans", value: String(overdueCount), icon: AlertTriangle, colour: overdueCount > 0 ? "text-warning" : "text-success" },
          { label: "Outstanding Debt", value: formatCurrency(totalOutstanding), icon: PoundSterling, colour: totalOutstanding > 0 ? "text-warning" : "text-success" },
        ].map(({ label, value, icon: Icon, colour }) => (
          <div key={label} className="bg-card border border-border rounded-md p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="label-caps mb-2">{label}</p>
                <p className={cn("font-mono text-[22px] font-medium leading-none", colour)}>{value}</p>
              </div>
              <Icon className="h-4 w-4 text-muted-foreground/30 mt-0.5" />
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 mb-4 animate-fade-up stagger-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name or address…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All customers</SelectItem>
            <SelectItem value="overdue">Overdue only</SelectItem>
            <SelectItem value="upcoming">Due this week</SelectItem>
            <SelectItem value="clear">Paid up</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Sort: Name</SelectItem>
            <SelectItem value="lastClean">Sort: Last clean</SelectItem>
            <SelectItem value="nextDue">Sort: Next due</SelectItem>
            <SelectItem value="outstanding">Sort: Outstanding</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Customer list */}
      <div className="animate-fade-up stagger-3">
        {filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-md py-14 text-center">
            <p className="text-[13px] text-muted-foreground">{customers.length === 0 ? "No customers yet. Add your first one!" : "No results."}</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-md overflow-hidden">
            {/* Table header */}
            <div className="hidden md:grid grid-cols-[1fr_1fr_auto_auto_auto] items-center gap-4 px-4 py-2 border-b border-border">
              <p className="label-caps">Customer</p>
              <p className="label-caps">Schedule</p>
              <p className="label-caps">Last clean</p>
              <p className="label-caps">Outstanding</p>
              <p className="label-caps"></p>
            </div>

            <div className="divide-y divide-border">
              {filtered.map(({ customer: c, lastJob, nextDue, daysOverdue, daysUntil, outstanding }) => {
                const isOverdue = daysOverdue > 0;
                return (
                  <div
                    key={c.id}
                    className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto_auto] items-center gap-3 md:gap-4 px-4 py-3.5 cursor-pointer hover:bg-muted/20 transition-colors group"
                    onClick={() => setSelectedCustomer(c)}
                  >
                    {/* Name + address */}
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={c.name} />
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-foreground truncate">{c.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5 shrink-0" />{c.address}
                        </p>
                      </div>
                    </div>

                    {/* Schedule */}
                    <div className="flex items-center gap-2">
                      <DueBadge daysOverdue={isOverdue ? daysOverdue : undefined} daysUntil={!isOverdue ? daysUntil : undefined} />
                      <span className="text-[11px] text-muted-foreground">{FREQUENCY_LABELS[c.frequency]}</span>
                    </div>

                    {/* Last clean */}
                    <div className="text-[12px] text-muted-foreground w-28 shrink-0">
                      {lastJob ? formatDate(lastJob.date) : <span className="text-muted-foreground/40">Never</span>}
                    </div>

                    {/* Outstanding */}
                    <div className={cn(
                      "font-mono text-[13px] font-medium w-20 shrink-0",
                      outstanding > 0 ? "text-warning" : "text-muted-foreground/40"
                    )}>
                      {outstanding > 0 ? formatCurrency(outstanding) : "—"}
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Customer Detail Sheet ── */}
      <Sheet open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
        <SheetContent className="w-full sm:max-w-md bg-card border-l border-border overflow-y-auto p-0">
          {sel && (
            <>
              {/* Header */}
              <div className="px-6 py-5 border-b border-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={sel.customer.name} />
                    <div>
                      <SheetTitle className="text-[15px] font-semibold text-foreground leading-none">{sel.customer.name}</SheetTitle>
                      <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />{sel.customer.address}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { openEdit(sel.customer); setSelectedCustomer(null); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 hover:text-destructive" onClick={() => { deleteCustomer(sel.customer.id); setSelectedCustomer(null); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Contact chips */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {sel.customer.phone && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted rounded px-2 py-0.5">
                      <Phone className="h-3 w-3" />{sel.customer.phone}
                    </span>
                  )}
                  {sel.customer.email && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted rounded px-2 py-0.5">
                      <Mail className="h-3 w-3" />{sel.customer.email}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 border-b border-border">
                {[
                  { label: "Frequency", value: FREQUENCY_LABELS[sel.customer.frequency] },
                  { label: "Total paid", value: formatCurrency(sel.totalPaid) },
                  { label: "Outstanding", value: formatCurrency(sel.outstanding), warn: sel.outstanding > 0 },
                ].map(({ label, value, warn }) => (
                  <div key={label} className="flex flex-col items-center justify-center py-4 border-r border-border last:border-r-0 gap-1">
                    <p className="label-caps text-center">{label}</p>
                    <p className={cn("font-mono text-[14px] font-medium", warn ? "text-warning" : "text-foreground")}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Next clean */}
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <p className="label-caps mb-1">Next clean due</p>
                  <p className="text-[13px] font-medium text-foreground">
                    {sel.nextDue.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" })}
                  </p>
                </div>
                <DueBadge
                  daysOverdue={sel.daysOverdue > 0 ? sel.daysOverdue : undefined}
                  daysUntil={sel.daysOverdue <= 0 ? sel.daysUntil : undefined}
                />
              </div>

              {/* SumUp Invoice CTA */}
              {sel.outstanding > 0 && (
                <div className="mx-5 my-4 rounded-md border border-primary/20 bg-primary/5 p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold text-foreground">Outstanding: {formatCurrency(sel.outstanding)}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Send an invoice via SumUp</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => sendInvoice(sel.customer, sel.outstanding)}
                    className="shrink-0"
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    Send Invoice
                  </Button>
                </div>
              )}

              {/* Jobs history */}
              <div className="px-5 pt-2 pb-3">
                <p className="label-caps mb-2">Job History</p>
                {selJobs.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground">No jobs recorded.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selJobs.slice(0, 6).map((j) => (
                      <div key={j.id} className="flex items-center justify-between rounded bg-muted/40 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className={cn("h-1.5 w-1.5 rounded-full", j.status === "completed" ? "bg-success" : j.status === "scheduled" ? "bg-primary" : "bg-muted-foreground/40")} />
                          <p className="text-[12px] text-foreground">{formatDate(j.date)}</p>
                          <span className="text-[10px] text-muted-foreground capitalize">{j.status}</span>
                        </div>
                        <p className="font-mono text-[12px] text-foreground">{formatCurrency(j.price)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payments history */}
              <div className="px-5 pt-1 pb-5">
                <p className="label-caps mb-2">Payment History</p>
                {selPayments.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground">No payments recorded.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selPayments.slice(0, 6).map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded bg-muted/40 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <PoundSterling className="h-3 w-3 text-success" />
                          <p className="text-[12px] text-foreground">{formatDate(p.date)}</p>
                          <span className="text-[10px] text-muted-foreground capitalize">{p.method.replace("-", " ")}</span>
                        </div>
                        <p className="font-mono text-[12px] text-success">+{formatCurrency(p.amount)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              {sel.customer.notes && (
                <div className="mx-5 mb-5 rounded bg-muted/30 border border-border px-3 py-2.5">
                  <p className="label-caps mb-1">Notes</p>
                  <p className="text-[12px] text-muted-foreground">{sel.customer.notes}</p>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border border-border">
          <DialogHeader>
            <DialogTitle className="text-[15px]">{editing ? "Edit Customer" : "Add Customer"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="label-caps mb-1.5 block">Full Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Smith" />
              </div>
              <div className="col-span-2">
                <Label className="label-caps mb-1.5 block">Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="12 High Street, Town, AB1 2CD" />
              </div>
              <div>
                <Label className="label-caps mb-1.5 block">Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="07700 900000" />
              </div>
              <div>
                <Label className="label-caps mb-1.5 block">Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@email.com" />
              </div>
              <div>
                <Label className="label-caps mb-1.5 block">Frequency</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v as Customer["frequency"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="label-caps mb-1.5 block">Price per clean (£)</Label>
                <Input type="number" min={0} step={0.5} value={form.pricePerClean || ""} onChange={(e) => setForm({ ...form, pricePerClean: parseFloat(e.target.value) || 0 })} placeholder="0.00" />
              </div>
              <div className="col-span-2">
                <Label className="label-caps mb-1.5 block">Notes</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Gate code, dogs, access notes…" />
              </div>
            </div>
            <Button onClick={handleSave} className="mt-1">{editing ? "Save Changes" : "Add Customer"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── SumUp Invoice Dialog ── */}
      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="sm:max-w-sm bg-card border border-border">
          <DialogHeader>
            <DialogTitle className="text-[15px] flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              Send Invoice via SumUp
            </DialogTitle>
          </DialogHeader>
          {invoiceCustomer && (() => {
            const e = enriched.find((x) => x.customer.id === invoiceCustomer.id);
            return (
              <div className="space-y-4 py-1">
                <div className="rounded-md border border-border bg-muted/30 divide-y divide-border">
                  {[
                    { label: "To", value: invoiceCustomer.name },
                    { label: "Email", value: invoiceCustomer.email || "—" },
                    { label: "Amount", value: formatCurrency(e?.outstanding ?? 0) },
                    { label: "Ref", value: `Window clean — ${FREQUENCY_LABELS[invoiceCustomer.frequency]}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between px-3 py-2">
                      <span className="text-[11px] text-muted-foreground">{label}</span>
                      <span className={cn("text-[12px] font-medium", label === "Amount" ? "text-primary font-mono" : "text-foreground")}>{value}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setInvoiceDialogOpen(false)}>Cancel</Button>
                  <Button className="flex-1" onClick={confirmInvoice}>
                    Send Invoice <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground/50 text-center">Mock integration — no real payment will be processed</p>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
