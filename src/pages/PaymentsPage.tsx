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
import { Plus, Trash2 } from "lucide-react";
import type { Payment } from "@/lib/store";

const METHOD_LABELS: Record<Payment["method"], string> = {
  cash: "Cash",
  "bank-transfer": "Bank Transfer",
  card: "Card",
  other: "Other",
};

export default function PaymentsPage() {
  const { customers, payments, addPayment, deletePayment } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ customerId: "", amount: 0, date: new Date().toISOString().split("T")[0], method: "cash" as Payment["method"], notes: "" });

  const sorted = useMemo(() => [...payments].sort((a, b) => b.date.localeCompare(a.date)), [payments]);
  const total = useMemo(() => payments.reduce((s, p) => s + p.amount, 0), [payments]);

  const openAdd = () => {
    setForm({ customerId: customers[0]?.id ?? "", amount: 0, date: new Date().toISOString().split("T")[0], method: "cash", notes: "" });
    setDialogOpen(true);
  };

  const handleAdd = () => {
    if (!form.customerId || !form.amount) return;
    addPayment(form);
    setDialogOpen(false);
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
        <div className="glass-card rounded-xl p-8 text-center animate-fade-up stagger-1">
          <p className="text-muted-foreground">No payments recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-3 animate-fade-up stagger-1">
          {sorted.map((p) => {
            const customer = customers.find((c) => c.id === p.customerId);
            return (
              <div key={p.id} className="glass-card group flex items-center justify-between rounded-xl px-5 py-4 transition-shadow hover:shadow-md">
                <div className="min-w-0">
                  <p className="font-medium truncate">{customer?.name ?? "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(p.date)}{p.notes ? ` · ${p.notes}` : ""}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-xs">{METHOD_LABELS[p.method]}</Badge>
                  <span className="text-sm font-bold text-success">{formatCurrency(p.amount)}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 transition-opacity group-hover:opacity-100" onClick={() => deletePayment(p.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
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
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
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
