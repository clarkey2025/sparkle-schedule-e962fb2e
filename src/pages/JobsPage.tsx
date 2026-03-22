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
import { Plus, Check, X, Trash2 } from "lucide-react";
import type { Job } from "@/lib/store";

export default function JobsPage() {
  const { customers, jobs, addJob, updateJob, deleteJob } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "scheduled" | "completed" | "cancelled">("all");
  const [form, setForm] = useState({ customerId: "", date: "", price: 0, notes: "" });

  const filtered = useMemo(() => {
    let list = [...jobs].sort((a, b) => b.date.localeCompare(a.date));
    if (filter !== "all") list = list.filter((j) => j.status === filter);
    return list;
  }, [jobs, filter]);

  const openAdd = () => {
    setForm({ customerId: customers[0]?.id ?? "", date: new Date().toISOString().split("T")[0], price: 0, notes: "" });
    setDialogOpen(true);
  };

  const handleAdd = () => {
    if (!form.customerId || !form.date) return;
    const customer = customers.find((c) => c.id === form.customerId);
    addJob({
      customerId: form.customerId,
      date: form.date,
      status: "scheduled",
      price: form.price || customer?.pricePerClean || 0,
      notes: form.notes,
    });
    setDialogOpen(false);
  };

  const statusColors: Record<Job["status"], string> = {
    scheduled: "bg-warning/10 text-warning border-warning/20",
    completed: "bg-success/10 text-success border-success/20",
    cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return (
    <div className="pb-20 md:pb-0">
      <PageHeader
        title="Jobs"
        description="Track every clean"
        action={
          <Button onClick={openAdd} size="sm" disabled={customers.length === 0}>
            <Plus className="h-4 w-4 mr-1" /> Log Job
          </Button>
        }
      />

      {/* Filters */}
      <div className="mb-5 flex gap-2 animate-fade-up stagger-1 flex-wrap">
        {(["all", "scheduled", "completed", "cancelled"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="capitalize">
            {f}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center animate-fade-up stagger-2">
          <p className="text-muted-foreground">
            {customers.length === 0 ? "Add a customer first to start logging jobs." : "No jobs found."}
          </p>
        </div>
      ) : (
        <div className="space-y-3 animate-fade-up stagger-2">
          {filtered.map((job) => {
            const customer = customers.find((c) => c.id === job.customerId);
            return (
              <div key={job.id} className="glass-card group flex items-center justify-between rounded-xl px-5 py-4 transition-shadow hover:shadow-md">
                <div className="min-w-0">
                  <p className="font-medium truncate">{customer?.name ?? "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(job.date)}{job.notes ? ` · ${job.notes}` : ""}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold">{formatCurrency(job.price)}</span>
                  <Badge variant="outline" className={`text-xs ${statusColors[job.status]}`}>
                    {job.status}
                  </Badge>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {job.status === "scheduled" && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-success" onClick={() => updateJob(job.id, { status: "completed" })}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => updateJob(job.id, { status: "cancelled" })}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteJob(job.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Log a Job</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Customer *</Label>
              <Select value={form.customerId} onValueChange={(v) => {
                const c = customers.find((x) => x.id === v);
                setForm({ ...form, customerId: v, price: c?.pricePerClean || form.price });
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date *</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <Label>Price (£)</Label>
              <Input type="number" min={0} step={0.5} value={form.price || ""} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <Button onClick={handleAdd} className="mt-2">Log Job</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
