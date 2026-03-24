import { useState, useMemo } from "react";
import { useApp } from "@/lib/AppContext";
import { formatCurrency, formatDate } from "@/lib/helpers";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { Plus, Trash2, Download } from "lucide-react";
import type { Payment } from "@/lib/store";

const PAGE_SIZE = 10;

const METHOD_LABELS: Record<Payment["method"], string> = {
  cash: "Cash",
  "bank-transfer": "Bank Transfer",
  card: "Card",
  other: "Other",
};

export default function PaymentsPage() {
  const { customers, payments, addPayment, deletePayment } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    customerId: "",
    amount: 0,
    date: new Date().toISOString().split("T")[0],
    method: "cash" as Payment["method"],
    notes: "",
  });

  const sorted = useMemo(
    () => [...payments].sort((a, b) => b.date.localeCompare(a.date)),
    [payments],
  );
  const total = useMemo(() => payments.reduce((s, p) => s + p.amount, 0), [payments]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const openAdd = () => {
    setForm({
      customerId: customers[0]?.id ?? "",
      amount: 0,
      date: new Date().toISOString().split("T")[0],
      method: "cash",
      notes: "",
    });
    setDialogOpen(true);
  };

  const handleAdd = () => {
    if (!form.customerId || !form.amount) return;
    addPayment(form);
    setDialogOpen(false);
    // Go to first page so the new entry is visible
    setPage(1);
  };

  return (
    <div className="pb-20 md:pb-0">
      <PageHeader
        title="Payments"
        description={`Total received: ${formatCurrency(total)}`}
        action={
          <Button onClick={openAdd} size="sm" disabled={customers.length === 0}>
            <Plus className="h-4 w-4 mr-1" /> Record Payment
          </Button>
        }
      />

      {sorted.length === 0 ? (
        <div className="surface rounded-md p-8 text-center animate-fade-up stagger-1">
          <p className="text-muted-foreground text-sm">No payments recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-3 animate-fade-up stagger-1">
          <div className="surface rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
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
                  return (
                    <TableRow key={p.id} className="group border-border">
                      <TableCell className="font-medium text-foreground">
                        {customer?.name ?? "Unknown"}
                      </TableCell>
                      <TableCell className="mono text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(p.date)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                          {METHOD_LABELS[p.method]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate hidden md:table-cell">
                        {p.notes || "—"}
                      </TableCell>
                      <TableCell className="mono text-sm text-right font-bold text-success whitespace-nowrap">
                        {formatCurrency(p.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => deletePayment(p.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1">
              <p className="text-[12px] text-muted-foreground">
                Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sorted.length)} of {sorted.length}
              </p>
              <Pagination className="w-auto mx-0">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className={safePage === 1 ? "pointer-events-none opacity-40" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="text-[12px] text-muted-foreground px-3 py-2 tabular-nums">
                      {safePage} / {totalPages}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className={safePage === totalPages ? "pointer-events-none opacity-40" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Customer *</Label>
              <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (£) *</Label>
                <Input
                  type="number" min={0} step={0.5}
                  value={form.amount || ""}
                  onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Method</Label>
              <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v as Payment["method"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(METHOD_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
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
