import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
import { Plus, Check, X, Trash2 } from "lucide-react";
import type { Job } from "@/lib/store";

const PAGE_SIZE = 5;

export default function JobsPage() {
  const { customers, jobs, addJob, updateJob, deleteJob } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "scheduled" | "completed" | "cancelled">("all");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ customerId: "", date: "", price: 0, notes: "" });

  // Auto-open dialog from ?add=1 (e.g. mobile FAB)
  useEffect(() => {
    if (searchParams.get("add") === "1" && customers.length > 0) {
      setForm({ customerId: customers[0]?.id ?? "", date: new Date().toISOString().split("T")[0], price: 0, notes: "" });
      setDialogOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, customers]);

  const filtered = useMemo(() => {
    let list = [...jobs].sort((a, b) => b.date.localeCompare(a.date));
    if (filter !== "all") list = list.filter((j) => j.status === filter);
    return list;
  }, [jobs, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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

  const statusBadge = (status: Job["status"]) => {
    const map: Record<Job["status"], string> = {
      scheduled: "bg-warning/10 text-warning border-warning/20",
      completed: "bg-success/10 text-success border-success/20",
      cancelled: "bg-destructive/10 text-destructive border-destructive/20",
    };
    return map[status];
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

      <div className="mb-4 flex gap-2 animate-fade-up stagger-1 flex-wrap">
        {(["all", "scheduled", "completed", "cancelled"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => { setFilter(f); setPage(1); }} className="capitalize text-xs">
            {f}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="surface rounded-md p-8 text-center animate-fade-up stagger-2">
          <p className="text-muted-foreground text-sm">
            {customers.length === 0 ? "Add a customer first to start logging jobs." : "No jobs found."}
          </p>
        </div>
      ) : (
        <div className="space-y-3 animate-fade-up stagger-2">
          <div className="surface rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="label-caps">Customer</TableHead>
                  <TableHead className="label-caps">Date</TableHead>
                  <TableHead className="label-caps">Notes</TableHead>
                  <TableHead className="label-caps text-right">Price</TableHead>
                  <TableHead className="label-caps text-center">Status</TableHead>
                  <TableHead className="label-caps text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((job) => {
                  const customer = customers.find((c) => c.id === job.customerId);
                  return (
                    <TableRow key={job.id} className="group border-border">
                      <TableCell className="font-medium text-foreground">{customer?.name ?? "Unknown"}</TableCell>
                      <TableCell className="mono text-sm text-muted-foreground">{formatDate(job.date)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{job.notes || "—"}</TableCell>
                      <TableCell className="mono text-sm text-right text-foreground">{formatCurrency(job.price)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${statusBadge(job.status)}`}>
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          {job.status === "scheduled" && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={() => updateJob(job.id, { status: "completed" })}>
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => updateJob(job.id, { status: "cancelled" })}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteJob(job.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {Array.from({ length: PAGE_SIZE - paginated.length }).map((_, i) => (
                  <TableRow key={`filler-${i}`} className="border-border pointer-events-none select-none">
                    <TableCell colSpan={6} className="py-[18px]" />
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
