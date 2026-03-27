import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useApp } from "@/lib/AppContext";
import { formatCurrency, formatDate, getNextDueDate, FREQUENCY_LABELS } from "@/lib/helpers";
import { geocodeCustomers, type GeocodeResult } from "@/lib/geocode";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Search, Trash2, Pencil, MapPin, Phone, Mail,
  AlertTriangle, CheckCircle2, ChevronRight, ChevronLeft,
  Clock, PoundSterling, Receipt, ArrowRight, User, Calendar,
  StickyNote, Check, Banknote, Download, FileText, Upload,
} from "lucide-react";
import type { Customer, Payment, CustomerService as CustomerServiceType } from "@/lib/store";
import { Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const PAGE_SIZE = 5;

const emptyForm = {
  name: "", address: "", phone: "", email: "",
  frequency: "weekly" as Customer["frequency"],
  pricePerClean: 0, notes: "",
  lastCleanDate: "" as string,
  nextDueDate: "" as string,
  roundId: "" as string,
};

const emptyPaymentForm = {
  amount: 0,
  date: format(new Date(), "yyyy-MM-dd"),
  method: "bank-transfer" as Payment["method"],
  notes: "",
};

type SortKey = "name" | "lastClean" | "outstanding" | "nextDue";
type FilterKey = "all" | "overdue" | "upcoming" | "clear";

// InitialsAvatar extracted to shared component
import InitialsAvatar from "@/components/InitialsAvatar";

function DueBadge({ daysOverdue, daysUntil }: { daysOverdue?: number; daysUntil?: number }) {
  if (daysOverdue !== undefined && daysOverdue > 0) {
    return (
      <span className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        daysOverdue > 14 ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"
      )}>
        <AlertTriangle className="h-2.5 w-2.5" />
        {daysOverdue}d late
      </span>
    );
  }
  if (daysUntil !== undefined) {
    if (daysUntil === 0) return <span className="inline-flex items-center gap-1 rounded bg-primary/15 text-primary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"><Clock className="h-2.5 w-2.5" />Today</span>;
    if (daysUntil <= 7) return <span className="inline-flex items-center gap-1 rounded bg-primary/10 text-primary/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"><Clock className="h-2.5 w-2.5" />In {daysUntil}d</span>;
    return <span className="inline-flex items-center gap-1 rounded bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"><CheckCircle2 className="h-2.5 w-2.5" />In {daysUntil}d</span>;
  }
  return null;
}

// ── Wizard step indicator ──────────────────────────────────────────────────────
const STEPS = [
  { label: "Details", icon: User },
  { label: "Schedule", icon: Calendar },
  { label: "Notes", icon: StickyNote },
];

function WizardSteps({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const done = i < current;
        const active = i === current;
        return (
          <div key={step.label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center transition-all text-[11px] font-medium border",
                done ? "bg-primary border-primary text-primary-foreground"
                  : active ? "bg-primary/15 border-primary text-primary"
                  : "bg-muted/30 border-border text-muted-foreground"
              )}>
                {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
              <span className={cn("text-[9px] uppercase tracking-wide font-medium", active ? "text-primary" : "text-muted-foreground/50")}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("flex-1 h-px mx-2 mb-4 transition-colors", i < current ? "bg-primary/50" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const { customers, jobs, payments, services, customerServices, rounds, addCustomer, updateCustomer, deleteCustomer, addPayment, addCustomerService, deleteCustomerService } = useApp();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("nextDue");
  const [roundFilter, setRoundFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);

  // Auto-open wizard from ?add=1 (e.g. mobile FAB)
  useEffect(() => {
    if (searchParams.get("add") === "1") {
      setEditing(null);
      setForm(emptyForm);
      setWizardStep(0);
      setWizardOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Detail sheet
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Invoice dialog
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceCustomer, setInvoiceCustomer] = useState<Customer | null>(null);

  // Record payment form
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // CSV import state
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({});

  const CSV_FIELDS = [
    { key: "name", label: "Name", required: true },
    { key: "address", label: "Address" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "frequency", label: "Frequency" },
    { key: "pricePerClean", label: "Price per Clean" },
    { key: "lastCleanDate", label: "Last Clean Date" },
    { key: "nextDueDate", label: "Next Due Date" },
    { key: "outstanding", label: "Outstanding Balance" },
    { key: "notes", label: "Notes" },
  ];

  // Parse dates in various formats (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, etc.)
  const parseFlexibleDate = (raw: string): string => {
    if (!raw) return "";
    const trimmed = raw.trim();
    // Already ISO (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    // DD/MM/YYYY or DD-MM-YYYY (UK format)
    const ukMatch = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (ukMatch) {
      const [, day, month, year] = ukMatch;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    // Try native parse as fallback
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return "";
  };

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return;
    const splitRow = (row: string) => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const ch of row) {
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; continue; }
        current += ch;
      }
      result.push(current.trim());
      return result;
    };
    const headers = splitRow(lines[0]);
    const rows = lines.slice(1).map(splitRow).filter((r) => r.some((c) => c));
    setCsvHeaders(headers);
    setCsvRows(rows);

    // Auto-map by fuzzy match
    const autoMap: Record<string, string> = {};
    CSV_FIELDS.forEach(({ key }) => {
      const match = headers.find((h) => h.toLowerCase().replace(/[^a-z]/g, "").includes(key.toLowerCase().replace(/[^a-z]/g, "")));
      if (match) autoMap[key] = match;
    });
    setCsvMapping(autoMap);
    setCsvImportOpen(true);
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const VALID_FREQUENCIES = ["weekly", "fortnightly", "monthly", "6-weekly", "quarterly"];

  const parseFrequency = (raw: string): Customer["frequency"] => {
    const v = raw.toLowerCase().trim().replace(/[\s\-_]+/g, "");
    if (v === "weekly" || v === "1weekly" || v === "everyweek") return "weekly";
    if (["fortnightly", "biweekly", "2weekly", "every2weeks", "twoweekly", "everyotherweek"].includes(v)) return "fortnightly";
    if (["monthly", "4weekly", "every4weeks", "everymonth"].includes(v)) return "monthly";
    if (["6weekly", "6week", "every6weeks", "sixweekly"].includes(v)) return "6-weekly";
    if (["quarterly", "every3months", "3monthly", "12weekly"].includes(v)) return "quarterly";
    // Try numeric week patterns e.g. "2" or "4"
    if (v === "2") return "fortnightly";
    if (v === "4") return "monthly";
    if (v === "6") return "6-weekly";
    // Fallback
    if (VALID_FREQUENCIES.includes(raw.toLowerCase().replace(/\s/g, "-"))) return raw.toLowerCase().replace(/\s/g, "-") as Customer["frequency"];
    return "monthly";
  };

  const handleCsvImport = () => {
    const nameCol = csvMapping.name;
    if (!nameCol) {
      toast({ title: "Map required", description: "Please map the Name column.", variant: "destructive" });
      return;
    }
    let imported = 0;
    csvRows.forEach((row) => {
      const getValue = (field: string) => {
        const header = csvMapping[field];
        if (!header) return "";
        const idx = csvHeaders.indexOf(header);
        return idx >= 0 ? (row[idx] || "") : "";
      };
      const name = getValue("name");
      if (!name) return;
      const frequency = parseFrequency(getValue("frequency"));
      const price = parseFloat(getValue("pricePerClean")) || 0;
      const lastClean = parseFlexibleDate(getValue("lastCleanDate"));
      const nextDueRaw = parseFlexibleDate(getValue("nextDueDate"));
      const outstandingRaw = parseFloat(getValue("outstanding")) || 0;

      // If next due is empty, calculate from last clean + frequency (or from today if no last clean)
      let nextDue = nextDueRaw;
      if (!nextDue) {
        const calculatedNext = getNextDueDate(lastClean || undefined, frequency);
        nextDue = calculatedNext.toISOString().slice(0, 10);
      }

      addCustomer({
        name,
        address: getValue("address"),
        phone: getValue("phone"),
        email: getValue("email"),
        frequency,
        pricePerClean: price,
        notes: getValue("notes"),
        lastCleanDate: lastClean,
        nextDueDate: nextDue,
        importedBalance: outstandingRaw,
      });
      imported++;
    });
    setCsvImportOpen(false);
    toast({ title: `Imported ${imported} customers`, description: `${imported} customers added from CSV. Geocoding addresses…` });
    // Auto-geocode after import
    triggerGeocode();
  };

  const [geocoding, setGeocoding] = useState(false);
  const [geoProgress, setGeoProgress] = useState({ done: 0, total: 0 });
  const [geoFailedList, setGeoFailedList] = useState<GeocodeResult["failed"]>([]);
  const [geoSummaryOpen, setGeoSummaryOpen] = useState(false);

  const triggerGeocode = useCallback(async (forceAll = false) => {
    let targets = customers.filter((c) => c.address.trim());
    if (forceAll) {
      // Clear existing coords first
      targets.forEach((c) => {
        if (c.lat || c.lng) updateCustomer(c.id, { lat: undefined, lng: undefined });
      });
    } else {
      targets = targets.filter((c) => !c.lat || !c.lng);
    }
    if (targets.length === 0) {
      toast({ title: "All geocoded", description: "Every customer already has coordinates." });
      return;
    }
    setGeocoding(true);
    setGeoProgress({ done: 0, total: targets.length });
    const result = await geocodeCustomers(
      targets.map((c) => ({ id: c.id, name: c.name, address: c.address })),
      (id, coords) => updateCustomer(id, coords),
      (done, total) => setGeoProgress({ done, total }),
    );
    setGeocoding(false);
    if (result.failed.length > 0) {
      setGeoFailedList(result.failed);
      setGeoSummaryOpen(true);
      toast({ title: `Geocoded ${result.successCount} addresses`, description: `${result.failed.length} failed — tap for details.`, variant: "destructive" });
    } else {
      toast({ title: `All ${result.successCount} addresses geocoded`, description: "Every address was mapped successfully." });
    }
  }, [customers, updateCustomer, toast]);

  // One-time re-geocode with structured queries
  const hasRegeocoded = useRef(false);
  useEffect(() => {
    const key = "pane-pro-structured-geocode-v4-uk-filter";
    if (!hasRegeocoded.current && !localStorage.getItem(key) && customers.length > 0) {
      hasRegeocoded.current = true;
      localStorage.setItem(key, "done");
      triggerGeocode(true);
    }
  }, [customers.length, triggerGeocode]);

  const now = new Date();

  // Enrich
  const enriched = useMemo(() => {
    return customers.map((c) => {
      const customerJobs = jobs.filter((j) => j.customerId === c.id);
      const completedJobs = customerJobs.filter((j) => j.status === "completed");
      const lastJob = [...completedJobs].sort((a, b) => b.date.localeCompare(a.date))[0];
      const lastCleanDate = lastJob?.date || c.lastCleanDate || undefined;
      const nextDue = c.nextDueDate ? new Date(c.nextDueDate) : getNextDueDate(lastCleanDate, c.frequency);
      const daysOverdue = Math.round((now.getTime() - nextDue.getTime()) / (1000 * 60 * 60 * 24));
      const daysUntil = -daysOverdue;
      const totalCharged = completedJobs.reduce((s, j) => s + j.price, 0);
      const totalPaid = payments.filter((p) => p.customerId === c.id).reduce((s, p) => s + p.amount, 0);
      const outstanding = Math.max(0, totalCharged - totalPaid + (c.importedBalance || 0));
      return { customer: c, lastJob, lastCleanDate, nextDue, daysOverdue, daysUntil, totalCharged, totalPaid, outstanding };
    });
  }, [customers, jobs, payments]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = enriched.filter(({ customer: c }) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.address.toLowerCase().includes(search.toLowerCase())
    );
    if (filter === "overdue") list = list.filter(({ daysOverdue }) => daysOverdue > 0);
    if (filter === "upcoming") list = list.filter(({ daysUntil }) => daysUntil >= 0 && daysUntil <= 7);
    if (filter === "clear") list = list.filter(({ outstanding }) => outstanding === 0);
    if (roundFilter === "unassigned") list = list.filter(({ customer: c }) => !c.roundId);
    else if (roundFilter !== "all") list = list.filter(({ customer: c }) => c.roundId === roundFilter);
    list = [...list].sort((a, b) => {
      if (sort === "name") return a.customer.name.localeCompare(b.customer.name);
      if (sort === "lastClean") return (b.lastCleanDate ?? "").localeCompare(a.lastCleanDate ?? "");
      if (sort === "outstanding") return b.outstanding - a.outstanding;
      if (sort === "nextDue") return a.nextDue.getTime() - b.nextDue.getTime();
      return 0;
    });
    return list;
  }, [enriched, search, filter, sort, roundFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const pageSlice = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };
  const handleFilterChange = (v: FilterKey) => { setFilter(v); setPage(1); };
  const handleSortChange = (v: SortKey) => { setSort(v); setPage(1); };
  const handleRoundFilterChange = (v: string) => { setRoundFilter(v); setPage(1); };

  // Summary stats
  const totalOutstanding = enriched.reduce((s, { outstanding }) => s + outstanding, 0);
  const overdueCount = enriched.filter(({ daysOverdue }) => daysOverdue > 0).length;

  // Wizard helpers
  const openAdd = () => { setEditing(null); setForm(emptyForm); setWizardStep(0); setWizardOpen(true); };
  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      name: c.name, address: c.address, phone: c.phone, email: c.email,
      frequency: c.frequency, pricePerClean: c.pricePerClean, notes: c.notes,
      lastCleanDate: c.lastCleanDate || "",
      nextDueDate: c.nextDueDate || "",
      roundId: c.roundId || "",
    });
    setWizardStep(0);
    setWizardOpen(true);
  };
  const handleWizardNext = () => setWizardStep((s) => Math.min(s + 1, STEPS.length - 1));
  const handleWizardBack = () => setWizardStep((s) => Math.max(s - 1, 0));
  const handleSave = () => {
    if (!form.name.trim()) return;
    const saveData = { ...form, roundId: form.roundId || undefined };
    editing ? updateCustomer(editing.id, saveData) : addCustomer(saveData);
    setWizardOpen(false);
    toast({ title: editing ? "Customer updated" : "Customer added", description: form.name });
  };

  // Invoice
  const sendInvoice = (c: Customer) => { setInvoiceCustomer(c); setInvoiceDialogOpen(true); setSelectedCustomer(null); };
  const confirmInvoice = () => {
    setInvoiceDialogOpen(false);
    toast({
      title: "Invoice sent via SumUp",
      description: `${invoiceCustomer?.name} has been sent an invoice for ${formatCurrency(enriched.find((e) => e.customer.id === invoiceCustomer?.id)?.outstanding ?? 0)}.`,
    });
  };

  // Record payment
  const openPaymentForm = () => {
    setPaymentForm({ ...emptyPaymentForm, date: format(new Date(), "yyyy-MM-dd") });
    setPaymentFormOpen(true);
  };
  const handleRecordPayment = () => {
    if (!selectedCustomer || paymentForm.amount <= 0) return;
    addPayment({
      customerId: selectedCustomer.id,
      amount: paymentForm.amount,
      date: new Date(paymentForm.date).toISOString(),
      method: paymentForm.method,
      notes: paymentForm.notes,
    });
    setPaymentFormOpen(false);
    toast({ title: "Payment recorded", description: `${formatCurrency(paymentForm.amount)} from ${selectedCustomer.name}` });
  };

  // Bulk selection helpers
  const allVisibleIds = pageSlice.map(({ customer }) => customer.id);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allVisibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allVisibleIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };
  const clearSelection = () => setSelectedIds(new Set());

  const bulkMarkInvoiced = () => {
    const names = customers.filter((c) => selectedIds.has(c.id)).map((c) => c.name);
    toast({ title: "Invoices sent", description: `Marked ${names.length} customer${names.length > 1 ? "s" : ""} as invoiced via SumUp.` });
    clearSelection();
  };

  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const bulkDelete = () => {
    selectedIds.forEach((id) => deleteCustomer(id));
    toast({ title: "Deleted", description: `Removed ${selectedIds.size} customer${selectedIds.size > 1 ? "s" : ""}.` });
    clearSelection();
    setShowBulkDelete(false);
  };

  const bulkExportCsv = () => {
    const selected = enriched.filter(({ customer }) => selectedIds.has(customer.id));
    const headers = ["Name", "Address", "Phone", "Email", "Frequency", "Price Per Clean", "Outstanding", "Last Clean"];
    const rows = selected.map(({ customer: c, outstanding, lastCleanDate }) => [
      c.name, c.address, c.phone, c.email, FREQUENCY_LABELS[c.frequency],
      c.pricePerClean.toFixed(2), outstanding.toFixed(2), lastCleanDate ? formatDate(lastCleanDate) : "Never",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exported", description: `${selected.length} customer${selected.length > 1 ? "s" : ""} exported.` });
  };

  // Selected customer detail
  const sel = selectedCustomer ? enriched.find((e) => e.customer.id === selectedCustomer.id) : null;
  const selJobs = selectedCustomer ? jobs.filter((j) => j.customerId === selectedCustomer.id).sort((a, b) => b.date.localeCompare(a.date)) : [];
  const selPayments = selectedCustomer ? payments.filter((p) => p.customerId === selectedCustomer.id).sort((a, b) => b.date.localeCompare(a.date)) : [];
  const selServices = selectedCustomer ? customerServices.filter((cs) => cs.customerId === selectedCustomer.id) : [];

  // Add service state
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [serviceForm, setServiceForm] = useState({ serviceId: "", price: 0, type: "recurring" as "recurring" | "one-off", frequency: "monthly" as Customer["frequency"], notes: "" });

  return (
    <div className="pb-24 md:pb-0 flex flex-col gap-5">
      <PageHeader
        title="Customers"
        description={`${customers.length} customers · ${overdueCount > 0 ? `${overdueCount} overdue` : "all up to date"}`}
        action={
          <div className="flex gap-2 items-center">
            {geocoding && (
              <span className="text-[11px] text-muted-foreground font-mono animate-pulse">
                📍 Geocoding {geoProgress.done}/{geoProgress.total}…
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => triggerGeocode()} disabled={geocoding}>
              <MapPin className="h-3.5 w-3.5" /> Geocode
            </Button>
            <Button variant="outline" size="sm" onClick={() => csvInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Import CSV
            </Button>
            <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFile} />
            <Button onClick={openAdd} size="sm">
              <Plus className="h-3.5 w-3.5" /> Add Customer
            </Button>
          </div>
        }
      />

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3 animate-fade-up stagger-1">
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
      <div className="flex flex-wrap gap-2 animate-fade-up stagger-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name or address…" className="pl-9 h-9" value={search} onChange={(e) => handleSearchChange(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={(v) => handleFilterChange(v as FilterKey)}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All customers</SelectItem>
            <SelectItem value="overdue">Overdue only</SelectItem>
            <SelectItem value="upcoming">Due this week</SelectItem>
            <SelectItem value="clear">Paid up</SelectItem>
          </SelectContent>
        </Select>
        {rounds.length > 0 && (
          <Select value={roundFilter} onValueChange={handleRoundFilterChange}>
            <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All rounds</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {rounds.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  <span className="inline-block h-2 w-2 rounded-full mr-1.5 align-middle" style={{ backgroundColor: r.colour }} />
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={sort} onValueChange={(v) => handleSortChange(v as SortKey)}>
          <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Sort: Name</SelectItem>
            <SelectItem value="lastClean">Sort: Last clean</SelectItem>
            <SelectItem value="nextDue">Sort: Next due</SelectItem>
            <SelectItem value="outstanding">Sort: Outstanding</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk action toolbar */}
      {someSelected && (
        <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-md px-4 py-2.5 animate-fade-up">
          <span className="text-[12px] font-medium text-foreground">{selectedIds.size} selected</span>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={bulkMarkInvoiced}>
            <FileText className="h-3.5 w-3.5" /> Mark Invoiced
          </Button>
          <Button variant="outline" size="sm" onClick={bulkExportCsv}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setShowBulkDelete(true)}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      )}

      <AlertDialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} customer{selectedIds.size > 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the selected customers and all their jobs, payments, and services. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={bulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Table */}
      <div className="animate-fade-up stagger-3 flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-md py-16 text-center">
            <p className="text-[13px] text-muted-foreground">{customers.length === 0 ? "No customers yet — add your first one." : "No results for this filter."}</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-md overflow-hidden">
            {/* Table header */}
            <div className="hidden md:grid grid-cols-[32px_1fr_1fr_130px_110px_32px] items-center gap-4 px-4 py-2.5 border-b border-border bg-muted/20">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleAll}
                className="h-3.5 w-3.5"
              />
              <p className="label-caps">Customer</p>
              <p className="label-caps">Schedule</p>
              <p className="label-caps">Last clean</p>
              <p className="label-caps">Outstanding</p>
              <p />
            </div>
            <div className="divide-y divide-border" style={{ minHeight: `${PAGE_SIZE * 65}px` }}>
              {pageSlice.map(({ customer: c, lastCleanDate, daysOverdue, daysUntil, outstanding }) => {
                const isOverdue = daysOverdue > 0;
                const isChecked = selectedIds.has(c.id);
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "grid grid-cols-1 md:grid-cols-[32px_1fr_1fr_130px_110px_32px] items-center gap-3 md:gap-4 px-4 py-3.5 cursor-pointer hover:bg-muted/20 transition-colors group border-l-2",
                      isChecked && "bg-primary/5",
                      isOverdue && daysOverdue > 14
                        ? "border-l-destructive bg-destructive/[0.03]"
                        : isOverdue
                        ? "border-l-warning bg-warning/[0.03]"
                        : daysUntil <= 3
                        ? "border-l-primary"
                        : "border-l-transparent"
                    )}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleOne(c.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-3.5 w-3.5 hidden md:flex"
                    />
                    <div className="flex items-center gap-3 min-w-0" onClick={() => setSelectedCustomer(c)}>
                      <InitialsAvatar name={c.name} />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">{c.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5 shrink-0" />{c.address}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={() => setSelectedCustomer(c)}>
                      <DueBadge daysOverdue={isOverdue ? daysOverdue : undefined} daysUntil={!isOverdue ? daysUntil : undefined} />
                      <span className="text-[11px] text-muted-foreground">{FREQUENCY_LABELS[c.frequency]}</span>
                    </div>
                    <div className="text-[12px] text-muted-foreground" onClick={() => setSelectedCustomer(c)}>
                      {lastCleanDate ? formatDate(lastCleanDate) : <span className="text-muted-foreground/40">Never</span>}
                    </div>
                    <div className={cn("font-mono text-[13px] font-medium", outstanding > 0 ? "text-warning" : "text-muted-foreground/40")} onClick={() => setSelectedCustomer(c)}>
                      {outstanding > 0 ? formatCurrency(outstanding) : "—"}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors shrink-0 hidden md:block" onClick={() => setSelectedCustomer(c)} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-1">
            <p className="text-[11px] text-muted-foreground">
              Showing {(clampedPage - 1) * PAGE_SIZE + 1}–{Math.min(clampedPage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline" size="icon" className="h-7 w-7"
                disabled={clampedPage === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Button
                  key={p}
                  variant={p === clampedPage ? "default" : "ghost"}
                  size="icon"
                  className="h-7 w-7 text-[12px]"
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              ))}
              <Button
                variant="outline" size="icon" className="h-7 w-7"
                disabled={clampedPage === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Customer Detail Sheet ───────────────────────────────────────────── */}
      <Sheet open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
        <SheetContent className="w-full sm:max-w-md bg-card border-l border-border p-0 flex flex-col overflow-hidden">
          {sel && (
            <>
              {/* Header */}
              <div className="px-6 py-5 border-b border-border shrink-0">
                <SheetHeader className="p-0 mb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <InitialsAvatar name={sel.customer.name} size="lg" />
                      <div>
                        <SheetTitle className="text-[15px] font-medium text-foreground leading-tight">{sel.customer.name}</SheetTitle>
                        <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />{sel.customer.address}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { openEdit(sel.customer); setSelectedCustomer(null); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => { deleteCustomer(sel.customer.id); setSelectedCustomer(null); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Contact chips */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {sel.customer.phone && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 rounded px-2 py-0.5">
                        <Phone className="h-3 w-3" />{sel.customer.phone}
                      </span>
                    )}
                    {sel.customer.email && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 rounded px-2 py-0.5">
                        <Mail className="h-3 w-3" />{sel.customer.email}
                      </span>
                    )}
                  </div>
                </SheetHeader>
              </div>

              {/* Stat strip */}
              <div className="grid grid-cols-3 border-b border-border shrink-0">
                {[
                  { label: "Frequency", value: FREQUENCY_LABELS[sel.customer.frequency] },
                  { label: "Total paid", value: formatCurrency(sel.totalPaid) },
                  { label: "Outstanding", value: formatCurrency(sel.outstanding), warn: sel.outstanding > 0 },
                ].map(({ label, value, warn }) => (
                  <div key={label} className="flex flex-col items-center justify-center py-3.5 border-r border-border last:border-r-0 gap-1">
                    <p className="label-caps text-center leading-none">{label}</p>
                    <p className={cn("font-mono text-[13px] font-medium mt-0.5", warn ? "text-warning" : "text-foreground")}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <Tabs defaultValue="overview" className="flex flex-col flex-1 overflow-hidden">
                <TabsList className="w-full rounded-none border-b border-border bg-transparent h-10 px-6 gap-1 justify-start shrink-0">
                  {["overview", "jobs", "payments", "ledger", "services"].map((tab) => (
                    <TabsTrigger
                      key={tab}
                      value={tab}
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground text-muted-foreground capitalize text-[12px] h-full px-3 font-medium"
                    >
                      {tab}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* ── Overview tab ── */}
                <TabsContent value="overview" className="flex-1 overflow-y-auto p-5 space-y-4 mt-0">
                  {/* Next due */}
                  <div className="bg-muted/20 border border-border rounded-md px-4 py-3 flex items-center justify-between">
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

                  {/* Price */}
                  <div className="bg-muted/20 border border-border rounded-md px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="label-caps mb-1">Price per clean</p>
                      <p className="font-mono text-[18px] font-medium text-foreground">{formatCurrency(sel.customer.pricePerClean)}</p>
                    </div>
                    <Banknote className="h-5 w-5 text-muted-foreground/30" />
                  </div>

                  {/* SumUp CTA */}
                  {sel.outstanding > 0 && (
                    <div className="rounded-md border border-primary/20 bg-primary/5 p-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[12px] font-medium text-foreground">Outstanding: {formatCurrency(sel.outstanding)}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Send invoice via SumUp</p>
                      </div>
                      <Button size="sm" onClick={() => sendInvoice(sel.customer)} className="shrink-0">
                        <Receipt className="h-3.5 w-3.5" /> Send
                      </Button>
                    </div>
                  )}

                  {/* Notes */}
                  {sel.customer.notes && (
                    <div className="rounded-md border border-border bg-muted/20 px-4 py-3">
                      <p className="label-caps mb-1.5">Notes</p>
                      <p className="text-[12px] text-muted-foreground leading-relaxed">{sel.customer.notes}</p>
                    </div>
                  )}
                </TabsContent>

                {/* ── Jobs tab ── */}
                <TabsContent value="jobs" className="flex-1 overflow-y-auto p-5 mt-0">
                  <div className="flex items-center justify-between mb-3">
                    <p className="label-caps">Job History</p>
                    <p className="text-[11px] text-muted-foreground font-mono">{selJobs.length} jobs</p>
                  </div>
                  {selJobs.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground py-8 text-center">No jobs recorded yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {selJobs.map((j) => (
                        <div key={j.id} className="flex items-center justify-between rounded-md bg-muted/30 border border-border/50 px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className={cn(
                              "h-2 w-2 rounded-full shrink-0",
                              j.status === "completed" ? "bg-success" : j.status === "scheduled" ? "bg-primary" : "bg-muted-foreground/40"
                            )} />
                            <div>
                              <p className="text-[12px] font-medium text-foreground">{formatDate(j.date)}</p>
                              <p className="text-[10px] text-muted-foreground capitalize">{j.status}{j.notes ? ` · ${j.notes}` : ""}</p>
                            </div>
                          </div>
                          <p className="font-mono text-[12px] text-foreground">{formatCurrency(j.price)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* ── Payments tab ── */}
                <TabsContent value="payments" className="flex-1 overflow-y-auto p-5 mt-0">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="label-caps">Payment History</p>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{formatCurrency(sel.totalPaid)} total</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={openPaymentForm}>
                      <Plus className="h-3.5 w-3.5" /> Record Payment
                    </Button>
                  </div>

                  {/* Inline payment form */}
                  {paymentFormOpen && (
                    <div className="rounded-md border border-primary/20 bg-primary/5 p-4 mb-4 space-y-3">
                      <p className="text-[12px] font-medium text-foreground">Record Payment</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="label-caps mb-1 block">Amount (£)</Label>
                          <Input
                            type="number" min={0} step={0.01}
                            value={paymentForm.amount || ""}
                            onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                            placeholder="0.00"
                            className="h-8 text-[12px]"
                          />
                        </div>
                        <div>
                          <Label className="label-caps mb-1 block">Date</Label>
                          <Input
                            type="date"
                            value={paymentForm.date}
                            onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                            className="h-8 text-[12px]"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="label-caps mb-1 block">Method</Label>
                        <Select value={paymentForm.method} onValueChange={(v) => setPaymentForm({ ...paymentForm, method: v as Payment["method"] })}>
                          <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                            <SelectItem value="card">Card</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="label-caps mb-1 block">Notes</Label>
                        <Input
                          value={paymentForm.notes}
                          onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                          placeholder="Optional note…"
                          className="h-8 text-[12px]"
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => setPaymentFormOpen(false)}>Cancel</Button>
                        <Button size="sm" className="flex-1" onClick={handleRecordPayment} disabled={paymentForm.amount <= 0}>
                          <Check className="h-3.5 w-3.5" /> Save
                        </Button>
                      </div>
                    </div>
                  )}

                  {selPayments.length === 0 && !paymentFormOpen ? (
                    <div className="py-8 text-center">
                      <p className="text-[12px] text-muted-foreground">No payments recorded yet.</p>
                      {sel.outstanding > 0 && (
                        <Button size="sm" variant="outline" className="mt-3" onClick={() => sendInvoice(sel.customer)}>
                          <Receipt className="h-3.5 w-3.5" /> Send Invoice
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {selPayments.map((p) => (
                        <div key={p.id} className="flex items-center justify-between rounded-md bg-muted/30 border border-border/50 px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <PoundSterling className="h-3.5 w-3.5 text-success shrink-0" />
                            <div>
                              <p className="text-[12px] font-medium text-foreground">{formatDate(p.date)}</p>
                              <p className="text-[10px] text-muted-foreground capitalize">{p.method.replace("-", " ")}{p.notes ? ` · ${p.notes}` : ""}</p>
                            </div>
                          </div>
                          <p className="font-mono text-[12px] text-success">+{formatCurrency(p.amount)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* ── Ledger tab ── */}
                <TabsContent value="ledger" className="flex-1 overflow-y-auto p-5 mt-0">
                  {(() => {
                    // Build chronological ledger entries from completed jobs and payments
                    const entries: { date: string; type: "charge" | "payment"; description: string; amount: number; id: string }[] = [];
                    
                    // Add completed jobs as charges
                    selJobs
                      .filter((j) => j.status === "completed")
                      .forEach((j) => {
                        entries.push({
                          date: j.date,
                          type: "charge",
                          description: `Window clean${j.notes ? ` · ${j.notes}` : ""}`,
                          amount: j.price,
                          id: `job-${j.id}`,
                        });
                      });
                    
                    // Add payments
                    selPayments.forEach((p) => {
                      entries.push({
                        date: p.date,
                        type: "payment",
                        description: `${p.method.replace("-", " ")}${p.notes ? ` · ${p.notes}` : ""}`,
                        amount: p.amount,
                        id: `pay-${p.id}`,
                      });
                    });
                    
                    // Sort oldest first to compute running balance
                    entries.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
                    
                    // Compute running balance starting from imported balance
                    const importedBal = sel.customer.importedBalance || 0;
                    let running = importedBal;
                    const withBalance = entries.map((e) => {
                      if (e.type === "charge") running += e.amount;
                      else running -= e.amount;
                      return { ...e, balance: running };
                    });
                    
                    // Display newest first
                    const display = [...withBalance].reverse();

                    return (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="label-caps">Account Ledger</p>
                            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{entries.length} entries</p>
                          </div>
                          <div className="text-right">
                            <p className="label-caps">Balance</p>
                            <p className={cn(
                              "font-mono text-[14px] font-medium",
                              running > 0 ? "text-warning" : running === 0 ? "text-success" : "text-success"
                            )}>
                              {formatCurrency(Math.abs(running))}
                              {running > 0 ? " owed" : running < 0 ? " credit" : ""}
                            </p>
                          </div>
                        </div>

                        {importedBal > 0 && (
                          <div className="flex items-center justify-between rounded-md bg-warning/5 border border-warning/20 px-3 py-2 mb-2">
                            <p className="text-[11px] text-muted-foreground">Imported opening balance</p>
                            <p className="font-mono text-[12px] text-warning">{formatCurrency(importedBal)}</p>
                          </div>
                        )}

                        {display.length === 0 ? (
                          <div className="py-8 text-center">
                            <p className="text-[12px] text-muted-foreground">No transactions yet.</p>
                            <p className="text-[10px] text-muted-foreground/50 mt-1">Completed jobs and payments will appear here.</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {display.map((e) => (
                              <div key={e.id} className="flex items-center justify-between rounded-md bg-muted/30 border border-border/50 px-3 py-2.5">
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <span className={cn(
                                    "h-2 w-2 rounded-full shrink-0",
                                    e.type === "charge" ? "bg-warning" : "bg-success"
                                  )} />
                                  <div className="min-w-0">
                                    <p className="text-[12px] font-medium text-foreground truncate">{formatDate(e.date)}</p>
                                    <p className="text-[10px] text-muted-foreground capitalize truncate">{e.description}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <p className={cn(
                                    "font-mono text-[12px] font-medium w-[70px] text-right",
                                    e.type === "charge" ? "text-warning" : "text-success"
                                  )}>
                                    {e.type === "charge" ? "+" : "−"}{formatCurrency(e.amount)}
                                  </p>
                                  <p className={cn(
                                    "font-mono text-[11px] w-[70px] text-right",
                                    e.balance > 0 ? "text-warning/70" : "text-success/70"
                                  )}>
                                    {formatCurrency(Math.abs(e.balance))}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </TabsContent>

                {/* ── Services tab ── */}
                <TabsContent value="services" className="flex-1 overflow-y-auto p-5 mt-0">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="label-caps">Attached Services</p>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{selServices.length} service{selServices.length !== 1 ? "s" : ""}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => { setServiceForm({ serviceId: services[0]?.id || "", price: services[0]?.defaultPrice || 0, type: "recurring", frequency: "monthly", notes: "" }); setAddServiceOpen(true); }}>
                      <Plus className="h-3.5 w-3.5" /> Add Service
                    </Button>
                  </div>

                  {addServiceOpen && (
                    <div className="rounded-md border border-primary/20 bg-primary/5 p-4 mb-4 space-y-3">
                      <p className="text-[12px] font-medium text-foreground">Attach Service</p>
                      <div>
                        <Label className="label-caps mb-1 block">Service</Label>
                        <Select value={serviceForm.serviceId} onValueChange={(v) => {
                          const svc = services.find((s) => s.id === v);
                          setServiceForm({ ...serviceForm, serviceId: v, price: svc?.defaultPrice || 0 });
                        }}>
                          <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {services.filter((s) => s.category !== "window-cleaning").map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="label-caps mb-1 block">Price (£)</Label>
                          <Input type="number" min={0} step={0.5} value={serviceForm.price || ""} onChange={(e) => setServiceForm({ ...serviceForm, price: parseFloat(e.target.value) || 0 })} className="h-8 text-[12px]" />
                        </div>
                        <div>
                          <Label className="label-caps mb-1 block">Type</Label>
                          <Select value={serviceForm.type} onValueChange={(v) => setServiceForm({ ...serviceForm, type: v as "recurring" | "one-off" })}>
                            <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="recurring">Recurring</SelectItem>
                              <SelectItem value="one-off">One-off</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {serviceForm.type === "recurring" && (
                        <div>
                          <Label className="label-caps mb-1 block">Frequency</Label>
                          <Select value={serviceForm.frequency} onValueChange={(v) => setServiceForm({ ...serviceForm, frequency: v as Customer["frequency"] })}>
                            <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div>
                        <Label className="label-caps mb-1 block">Notes</Label>
                        <Input value={serviceForm.notes} onChange={(e) => setServiceForm({ ...serviceForm, notes: e.target.value })} placeholder="Optional…" className="h-8 text-[12px]" />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => setAddServiceOpen(false)}>Cancel</Button>
                        <Button size="sm" className="flex-1" disabled={!serviceForm.serviceId} onClick={() => {
                          if (!selectedCustomer) return;
                          addCustomerService({
                            customerId: selectedCustomer.id,
                            serviceId: serviceForm.serviceId,
                            price: serviceForm.price,
                            type: serviceForm.type,
                            ...(serviceForm.type === "recurring" ? { frequency: serviceForm.frequency } : {}),
                            notes: serviceForm.notes,
                          });
                          setAddServiceOpen(false);
                          toast({ title: "Service attached", description: services.find((s) => s.id === serviceForm.serviceId)?.name });
                        }}>
                          <Check className="h-3.5 w-3.5" /> Add
                        </Button>
                      </div>
                    </div>
                  )}

                  {selServices.length === 0 && !addServiceOpen ? (
                    <div className="py-8 text-center">
                      <p className="text-[12px] text-muted-foreground">No extra services attached.</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-1">Add gutters, jet washing, caravan cleans & more.</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {selServices.map((cs) => {
                        const svc = services.find((s) => s.id === cs.serviceId);
                        return (
                          <div key={cs.id} className="flex items-center justify-between rounded-md bg-muted/30 border border-border/50 px-3 py-2.5 group">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Wrench className="h-3.5 w-3.5 text-primary shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[12px] font-medium text-foreground truncate">{svc?.name || "Unknown"}</p>
                                <p className="text-[10px] text-muted-foreground capitalize">
                                  {cs.type === "recurring" ? FREQUENCY_LABELS[cs.frequency || "monthly"] : "One-off"}
                                  {cs.notes ? ` · ${cs.notes}` : ""}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <p className="font-mono text-[12px] text-foreground">{formatCurrency(cs.price)}</p>
                              <Button
                                variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive/60 hover:text-destructive"
                                onClick={() => { deleteCustomerService(cs.id); toast({ title: "Service removed" }); }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Add / Edit Wizard Dialog ────────────────────────────────────────── */}
      <Dialog open={wizardOpen} onOpenChange={(open) => { if (!open) setWizardOpen(false); }}>
        <DialogContent className="sm:max-w-md bg-card border border-border">
          <DialogHeader>
            <DialogTitle className="text-[15px]">{editing ? "Edit Customer" : "New Customer"}</DialogTitle>
          </DialogHeader>

          <WizardSteps current={wizardStep} />

          {/* Step 0: Contact Details */}
          {wizardStep === 0 && (
            <div className="space-y-3">
              <div>
                <Label className="label-caps mb-1.5 block">Full Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Margaret Thornton" />
              </div>
              <div>
                <Label className="label-caps mb-1.5 block">Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="14 Harbour View, Fleetwood, FY7 6HJ" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="label-caps mb-1.5 block">Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="07700 900123" />
                </div>
                <div>
                  <Label className="label-caps mb-1.5 block">Email</Label>
                  <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="m.thornton@email.com" />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={handleWizardNext} disabled={!form.name.trim()}>
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 1: Schedule & Pricing */}
          {wizardStep === 1 && (
            <div className="space-y-3">
              <div>
                <Label className="label-caps mb-1.5 block">Clean Frequency</Label>
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
                <Label className="label-caps mb-1.5 block">Last Cleaned On</Label>
                <Input
                  type="date"
                  value={form.lastCleanDate}
                  onChange={(e) => setForm({ ...form, lastCleanDate: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground mt-1">When was their last clean? Leave blank if new customer.</p>
              </div>
              <div>
                <Label className="label-caps mb-1.5 block">Next Clean Due</Label>
                <Input
                  type="date"
                  value={form.nextDueDate}
                  onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground mt-1">Override the calculated due date, or leave blank to auto-calculate from frequency.</p>
              </div>
              <div>
                <Label className="label-caps mb-1.5 block">Price per clean (£)</Label>
                <Input
                  type="number" min={0} step={0.5}
                  value={form.pricePerClean || ""}
                  onChange={(e) => setForm({ ...form, pricePerClean: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
              {/* Round assignment */}
              {rounds.length > 0 && (
                <div>
                  <Label className="label-caps mb-1.5 block">Round</Label>
                  <Select value={form.roundId || "none"} onValueChange={(v) => setForm({ ...form, roundId: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="No round" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No round</SelectItem>
                      {rounds.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          <span className="inline-block h-2 w-2 rounded-full mr-1.5 align-middle" style={{ backgroundColor: r.colour }} />
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {/* Quick preview */}
              <div className="rounded-md bg-muted/30 border border-border px-3 py-2.5 flex justify-between items-center">
                <span className="text-[11px] text-muted-foreground">Est. annual revenue</span>
                <span className="font-mono text-[13px] font-medium text-foreground">
                  {formatCurrency(form.pricePerClean * { weekly: 52, fortnightly: 26, monthly: 12, "6-weekly": 8.5, quarterly: 4 }[form.frequency])}
                </span>
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={handleWizardBack}><ChevronLeft className="h-3.5 w-3.5" /> Back</Button>
                <Button onClick={handleWizardNext}>Next <ChevronRight className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          )}

          {/* Step 2: Notes & Confirm */}
          {wizardStep === 2 && (
            <div className="space-y-3">
              <div>
                <Label className="label-caps mb-1.5 block">Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Gate code, dogs on site, access notes, key holder…"
                  className="resize-none h-24 text-[13px]"
                />
              </div>
              {/* Summary */}
              <div className="rounded-md border border-border bg-muted/20 divide-y divide-border text-[12px]">
                {[
                  { label: "Name", value: form.name },
                  { label: "Address", value: form.address || "—" },
                  { label: "Frequency", value: FREQUENCY_LABELS[form.frequency] },
                  { label: "Price", value: formatCurrency(form.pricePerClean) },
                  ...(form.roundId ? [{ label: "Round", value: rounds.find((r) => r.id === form.roundId)?.name || "—" }] : []),
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between px-3 py-2">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium text-foreground text-right max-w-[60%] truncate">{value}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={handleWizardBack}><ChevronLeft className="h-3.5 w-3.5" /> Back</Button>
                <Button onClick={handleSave}>
                  {editing ? "Save Changes" : "Add Customer"} <Check className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── SumUp Invoice Dialog ─────────────────────────────────────────────── */}
      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="sm:max-w-sm bg-card border border-border">
          <DialogHeader>
            <DialogTitle className="text-[15px] flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" /> Send Invoice via SumUp
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
                  <Button className="flex-1" onClick={confirmInvoice}>Send Invoice <ArrowRight className="h-3.5 w-3.5" /></Button>
                </div>
                <p className="text-[10px] text-muted-foreground/50 text-center">Mock integration — no real payment processed</p>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={csvImportOpen} onOpenChange={setCsvImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Customers from CSV</DialogTitle>
          </DialogHeader>
          <p className="text-[12px] text-muted-foreground">
            Map your CSV columns to customer fields. {csvRows.length} rows found.
          </p>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {CSV_FIELDS.map(({ key, label, required }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-[11px] font-medium w-28 shrink-0">
                  {label}{required && <span className="text-destructive">*</span>}
                </span>
                <Select
                  value={csvMapping[key] || "__none__"}
                  onValueChange={(v) => setCsvMapping((m) => ({ ...m, [key]: v === "__none__" ? "" : v }))}
                >
                  <SelectTrigger className="h-8 text-[12px]"><SelectValue placeholder="— skip —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— skip —</SelectItem>
                    {csvHeaders.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          {/* Preview */}
          {csvRows.length > 0 && csvMapping.name && (
            <div className="rounded-md border border-border bg-muted/20 p-2 max-h-[140px] overflow-auto">
              <p className="text-[10px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">Preview (first 3)</p>
              {csvRows.slice(0, 3).map((row, i) => {
                const nameIdx = csvHeaders.indexOf(csvMapping.name);
                const addrIdx = csvMapping.address ? csvHeaders.indexOf(csvMapping.address) : -1;
                return (
                  <div key={i} className="text-[11px] text-foreground py-0.5 border-b border-border last:border-0">
                    {nameIdx >= 0 ? row[nameIdx] : "—"}{addrIdx >= 0 ? ` · ${row[addrIdx]}` : ""}
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setCsvImportOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCsvImport}>
              <Upload className="h-3.5 w-3.5" /> Import {csvRows.length} Customers
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Geocode failed summary dialog */}
      <Dialog open={geoSummaryOpen} onOpenChange={setGeoSummaryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {geoFailedList.length} Address{geoFailedList.length !== 1 ? "es" : ""} Failed
            </DialogTitle>
          </DialogHeader>
          <p className="text-[12px] text-muted-foreground -mt-2">
            These addresses couldn't be geocoded. Edit them to fix typos or add postcodes, then re-run Geocode.
          </p>
          <div className="max-h-[300px] overflow-auto rounded-md border border-border divide-y divide-border">
            {geoFailedList.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted/20 transition-colors cursor-pointer"
                onClick={() => {
                  const c = customers.find((c) => c.id === item.id);
                  if (c) { openEdit(c); setGeoSummaryOpen(false); }
                }}
              >
                <MapPin className="h-3.5 w-3.5 text-destructive/60 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-foreground">{item.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{item.address || "No address"}</p>
                </div>
                <Pencil className="h-3 w-3 text-muted-foreground/40 mt-1 shrink-0" />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setGeoSummaryOpen(false)}>
              Dismiss
            </Button>
            <Button size="sm" onClick={() => { setGeoSummaryOpen(false); triggerGeocode(); }}>
              <MapPin className="h-3.5 w-3.5" /> Retry All
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
