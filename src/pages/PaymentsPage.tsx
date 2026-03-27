import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useApp } from "@/lib/AppContext";
import { formatCurrency, formatDate } from "@/lib/helpers";
import PageHeader from "@/components/PageHeader";
import BulkActionBar from "@/components/BulkActionBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Trash2, Download, CalendarIcon, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Payment } from "@/lib/store";

const PAGE_SIZE = 5;

const METHOD_LABELS: Record<Payment["method"], string> = {
  cash: "Cash",
  "bank-transfer": "Bank Transfer",
  card: "Card",
  other: "Other",
};

export default function PaymentsPage() {
  const { customers, payments, addPayment, deletePayment, deletePayments } = useApp();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    customerId: "",
    amount: 0,
    date: new Date().toISOString().split("T")[0],
    method: "cash" as Payment["method"],
    notes: "",
  });

  const filtered = useMemo(() => {
    let list = [...payments].sort((a, b) => b.date.localeCompare(a.date));
    if (dateFrom) {
      const fromStr = format(dateFrom, "yyyy-MM-dd");
      list = list.filter((p) => p.date >= fromStr);
    }
    if (dateTo) {
      const toStr = format(dateTo, "yyyy-MM-dd");
      list = list.filter((p) => p.date <= toStr);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => {
        const cName = customers.find((c) => c.id === p.customerId)?.name ?? "";
        return cName.toLowerCase().includes(q) || p.notes.toLowerCase().includes(q);
      });
    }
    return list;
  }, [payments, dateFrom, dateTo, search, customers]);

  const filteredTotal = useMemo(() => filtered.reduce((s, p) => s + p.amount, 0), [filtered]);
  const hasFilter = dateFrom || dateTo || search.trim();

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const allPageSelected = paginated.length > 0 && paginated.every((p) => selectedIds.has(p.id));

  const toggleAll = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => { const next = new Set(prev); paginated.forEach((p) => next.delete(p.id)); return next; });
    } else {
      setSelectedIds((prev) => { const next = new Set(prev); paginated.forEach((p) => next.add(p.id)); return next; });
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const exportCSV = () => {
    const header = "Date,Customer,Amount,Method,Notes";
    const rows = filtered.map((p) => {
      const cName = customers.find((c) => c.id === p.customerId)?.name ?? "Unknown";
      const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
      return [p.date, escape(cName), p.amount.toFixed(2), METHOD_LABELS[p.method], escape(p.notes)].join(",");
    });
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payments-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => { setDateFrom(undefined); setDateTo(undefined); setSearch(""); setPage(1); };

  const openAdd = () => {
    setForm({ customerId: customers[0]?.id ?? "", amount: 0, date: new Date().toISOString().split("T")[0], method: "cash", notes: "" });
    setDialogOpen(true);
  };

  const handleAdd = () => {
    if (!form.customerId || !form.amount) return;
    addPayment(form);
    const customerName = customers.find(c => c.id === form.customerId)?.name ?? "Customer";
    toast({ title: "Payment recorded", description: `${formatCurrency(form.amount)} from ${customerName}` });
    setDialogOpen(false);
    setPage(1);
  };

  return (
    <div className="pb-20 md:pb-0 space-y-5">
      <PageHeader
        title="Payments"
        description={`Total received: ${formatCurrency(filteredTotal)}${hasFilter ? ` (filtered)` : ""}`}
        action={
          <div className="flex gap-2">
            {filtered.length > 0 && (
              <Button onClick={exportCSV} size="sm" variant="outline">
                <Download className="h-4 w-4 mr-1" /> Export CSV
              </Button>
            )}
            <Button onClick={openAdd} size="sm" disabled={customers.length === 0}>
              <Plus className="h-4 w-4 mr-1" /> Record Payment
            </Button>
          </div>
        }
      />

      {payments.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 animate-fade-up">
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search payments…"
              className="pl-8 h-8 text-xs w-[180px]"
            />
          </div>
          <DatePicker label="From" date={dateFrom} onSelect={(d) => { setDateFrom(d); setPage(1); }} />
          <DatePicker label="To" date={dateTo} onSelect={(d) => { setDateTo(d); setPage(1); }} />
          {hasFilter && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-muted-foreground">
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          )}
        </div>
      )}

      <BulkActionBar
        count={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        actions={[
          { label: "Delete", icon: <Trash2 className="h-3 w-3 mr-1" />, variant: "destructive", onClick: () => { const count = selectedIds.size; deletePayments(Array.from(selectedIds)); toast({ title: "Payments deleted", description: `${count} payment${count > 1 ? "s" : ""} removed` }); setSelectedIds(new Set()); } },
        ]}
      />

      {filtered.length === 0 ? (
        <div className="surface rounded-md p-8 text-center animate-fade-up stagger-1">
          <p className="text-muted-foreground text-sm">
            {hasFilter ? "No payments in this date range." : "No payments recorded yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3 animate-fade-up stagger-1">
          <div className="surface rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-[40px]">
                    <Checkbox checked={allPageSelected} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead className="label-caps">Customer</TableHead>
                  <TableHead className="label-caps">Date</TableHead>
                  <TableHead className="label-caps">Method</TableHead>
                  <TableHead className="label-caps hidden md:table-cell">Notes</TableHead>
                  <TableHead className="label-caps text-right">Amount</TableHead>
                  <TableHead className="label-caps text-right w-[52px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((p) => {
                  const customer = customers.find((c) => c.id === p.customerId);
                  const isSelected = selectedIds.has(p.id);
                  return (
                    <TableRow key={p.id} className={`group border-border ${isSelected ? "bg-primary/5" : ""}`}>
                      <TableCell>
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleOne(p.id)} />
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{customer?.name ?? "Unknown"}</TableCell>
                      <TableCell className="mono text-sm text-muted-foreground whitespace-nowrap">{formatDate(p.date)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">{METHOD_LABELS[p.method]}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate hidden md:table-cell">{p.notes || "—"}</TableCell>
                      <TableCell className="mono text-sm text-right font-medium text-success whitespace-nowrap">{formatCurrency(p.amount)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 transition-opacity group-hover:opacity-100" onClick={() => { deletePayment(p.id); toast({ title: "Payment deleted", description: `${formatCurrency(p.amount)} from ${customer?.name}` }); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {Array.from({ length: PAGE_SIZE - paginated.length }).map((_, i) => (
                  <TableRow key={`filler-${i}`} className="border-border pointer-events-none select-none">
                    <TableCell colSpan={7} className="py-[18px]" />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1">
              <p className="text-[12px] text-muted-foreground">
                Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <Pagination className="w-auto mx-0">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious onClick={() => setPage((p) => Math.max(1, p - 1))} className={safePage === 1 ? "pointer-events-none opacity-40" : "cursor-pointer"} />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="text-[12px] text-muted-foreground px-3 py-2 tabular-nums">{safePage} / {totalPages}</span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className={safePage === totalPages ? "pointer-events-none opacity-40" : "cursor-pointer"} />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Customer *</Label>
              <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (£) *</Label>
                <Input type="number" min={0} step={0.5} value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Method</Label>
              <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v as Payment["method"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(METHOD_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <Button onClick={handleAdd} className="mt-2">Save Payment</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DatePicker({ label, date, onSelect }: { label: string; date?: Date; onSelect: (d: Date | undefined) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("text-xs justify-start min-w-[140px]", !date && "text-muted-foreground")}>
          <CalendarIcon className="h-3 w-3 mr-1.5" />
          {date ? format(date, "d MMM yyyy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={onSelect} initialFocus className={cn("p-3 pointer-events-auto")} />
      </PopoverContent>
    </Popover>
  );
}
