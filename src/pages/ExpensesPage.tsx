import { useState, useMemo } from "react";
import { useApp } from "@/lib/AppContext";
import { formatCurrency, formatDate } from "@/lib/helpers";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Minus, Check, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExpenseCategory } from "@/lib/store";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";

const PAGE_SIZE = 10;

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "fuel", label: "Fuel" },
  { value: "supplies", label: "Supplies" },
  { value: "equipment", label: "Equipment" },
  { value: "vehicle", label: "Vehicle" },
  { value: "insurance", label: "Insurance" },
  { value: "marketing", label: "Marketing" },
  { value: "software", label: "Software" },
  { value: "other", label: "Other" },
];

const CATEGORY_COLOURS: Record<ExpenseCategory, string> = {
  fuel: "hsl(var(--chart-1))",
  supplies: "hsl(var(--chart-2))",
  equipment: "hsl(var(--chart-3))",
  vehicle: "hsl(var(--chart-4))",
  insurance: "hsl(var(--chart-5))",
  marketing: "hsl(var(--primary))",
  software: "hsl(var(--accent-foreground))",
  other: "hsl(var(--muted-foreground))",
};

const emptyExpenseForm = {
  amount: 0,
  date: format(new Date(), "yyyy-MM-dd"),
  category: "fuel" as ExpenseCategory,
  description: "",
  notes: "",
};

export default function ExpensesPage() {
  const {
    expenses, addExpense, deleteExpense,
    recurringExpenses, addRecurringExpense, updateRecurringExpense, deleteRecurringExpense,
  } = useApp();
  const { toast } = useToast();

  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);
  const [recurringForm, setRecurringForm] = useState({
    amount: 0, category: "insurance" as ExpenseCategory, description: "", dayOfMonth: 1,
  });
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);

  const categoryBreakdown = useMemo(() => {
    const cats: Record<string, number> = {};
    expenses.forEach((e) => { cats[e.category] = (cats[e.category] || 0) + e.amount; });
    return Object.entries(cats)
      .map(([category, amount]) => ({ category, amount, label: EXPENSE_CATEGORIES.find((c) => c.value === category)?.label || category }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  const filtered = useMemo(() => {
    let list = [...expenses].sort((a, b) => b.date.localeCompare(a.date));
    if (categoryFilter !== "all") list = list.filter((e) => e.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) => e.description.toLowerCase().includes(q) || e.notes.toLowerCase().includes(q));
    }
    return list;
  }, [expenses, categoryFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleAddExpense = () => {
    if (expenseForm.amount <= 0 || !expenseForm.description.trim()) return;
    addExpense({
      amount: expenseForm.amount, date: expenseForm.date,
      category: expenseForm.category, description: expenseForm.description.trim(),
      notes: expenseForm.notes.trim(),
    });
    toast({ title: "Expense logged", description: `${formatCurrency(expenseForm.amount)} — ${expenseForm.description}` });
    setExpenseForm(emptyExpenseForm);
    setExpenseDialogOpen(false);
  };

  const handleAddRecurring = () => {
    if (recurringForm.amount <= 0 || !recurringForm.description.trim()) return;
    addRecurringExpense({
      amount: recurringForm.amount, category: recurringForm.category,
      description: recurringForm.description.trim(), dayOfMonth: recurringForm.dayOfMonth, active: true,
    });
    toast({ title: "Recurring expense added", description: `${formatCurrency(recurringForm.amount)}/month` });
    setRecurringForm({ amount: 0, category: "insurance", description: "", dayOfMonth: 1 });
    setRecurringDialogOpen(false);
  };

  return (
    <div className="pb-20 md:pb-0 space-y-5">
      <PageHeader
        title="Expenses"
        description={`${expenses.length} expenses · ${formatCurrency(totalExpenses)} total`}
        action={
          <Button size="sm" onClick={() => { setExpenseForm(emptyExpenseForm); setExpenseDialogOpen(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Log Expense
          </Button>
        }
      />

      {/* Category breakdown */}
      {categoryBreakdown.length > 0 && (
        <div className="bg-card border border-border rounded-md p-4 animate-fade-up">
          <p className="text-[13px] font-medium text-foreground mb-3 flex items-center gap-2">
            <Minus className="h-4 w-4 text-destructive" /> By Category
          </p>
          <div className="space-y-2.5">
            {categoryBreakdown.map(({ category, amount, label }) => {
              const pct = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
              return (
                <div key={category}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[12px] font-medium text-foreground capitalize">{label}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">{formatCurrency(amount)} ({pct.toFixed(0)}%)</p>
                  </div>
                  <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLOURS[category as ExpenseCategory] || "hsl(var(--muted-foreground))" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 animate-fade-up">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search expenses…" className="pl-8 h-8 text-xs" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant={categoryFilter === "all" ? "default" : "outline"} size="sm" onClick={() => { setCategoryFilter("all"); setPage(1); }} className="text-xs">All</Button>
          {EXPENSE_CATEGORIES.map((c) => (
            <Button key={c.value} variant={categoryFilter === c.value ? "default" : "outline"} size="sm" onClick={() => { setCategoryFilter(c.value); setPage(1); }} className="text-xs">{c.label}</Button>
          ))}
        </div>
      </div>

      {/* Expense list */}
      {paginated.length === 0 ? (
        <div className="surface rounded-md p-10 text-center animate-fade-up">
          <Minus className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{expenses.length === 0 ? "No expenses logged yet." : "No matching expenses."}</p>
        </div>
      ) : (
        <div className="space-y-3 animate-fade-up">
          <div className="bg-card border border-border rounded-md divide-y divide-border">
            {paginated.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-4 py-3 group">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLOURS[e.category] }} />
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-foreground truncate">{e.description}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDate(e.date)} · <span className="capitalize">{EXPENSE_CATEGORIES.find((c) => c.value === e.category)?.label}</span>
                      {e.notes ? ` · ${e.notes}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className="font-mono text-[13px] font-medium text-destructive">−{formatCurrency(e.amount)}</p>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive/60 hover:text-destructive" onClick={() => { deleteExpense(e.id); toast({ title: "Expense deleted" }); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1">
              <p className="text-[12px] text-muted-foreground">Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}</p>
              <Pagination className="w-auto mx-0">
                <PaginationContent>
                  <PaginationItem><PaginationPrevious onClick={() => setPage((p) => Math.max(1, p - 1))} className={safePage === 1 ? "pointer-events-none opacity-40" : "cursor-pointer"} /></PaginationItem>
                  <PaginationItem><span className="text-[12px] text-muted-foreground px-3 py-2 tabular-nums">{safePage} / {totalPages}</span></PaginationItem>
                  <PaginationItem><PaginationNext onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className={safePage === totalPages ? "pointer-events-none opacity-40" : "cursor-pointer"} /></PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      )}

      {/* Recurring Expenses */}
      <div className="animate-fade-up">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[13px] font-medium text-foreground flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" /> Recurring Expenses
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {recurringExpenses.filter((r) => r.active).length} active · {formatCurrency(recurringExpenses.filter((r) => r.active).reduce((s, r) => s + r.amount, 0))}/month
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => {
            setRecurringForm({ amount: 0, category: "insurance", description: "", dayOfMonth: 1 });
            setRecurringDialogOpen(true);
          }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Recurring
          </Button>
        </div>

        {recurringExpenses.length === 0 ? (
          <div className="bg-card border border-border rounded-md py-8 text-center">
            <p className="text-[12px] text-muted-foreground">No recurring expenses set up.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-md divide-y divide-border">
            {recurringExpenses.map((re) => (
              <div key={re.id} className="flex items-center justify-between px-4 py-3 group">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLOURS[re.category] }} />
                  <div className="min-w-0">
                    <p className={cn("text-[12px] font-medium truncate", re.active ? "text-foreground" : "text-muted-foreground line-through")}>{re.description}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {EXPENSE_CATEGORIES.find((c) => c.value === re.category)?.label} · Day {re.dayOfMonth} of each month
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <p className={cn("font-mono text-[13px] font-medium", re.active ? "text-destructive" : "text-muted-foreground")}>{formatCurrency(re.amount)}/mo</p>
                  <Switch checked={re.active} onCheckedChange={(checked) => updateRecurringExpense(re.id, { active: checked })} className="scale-75" />
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive/60 hover:text-destructive" onClick={() => { deleteRecurringExpense(re.id); toast({ title: "Recurring expense removed" }); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Expense Dialog */}
      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Log Expense</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="label-caps mb-1.5 block">Description *</Label>
              <Input value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="e.g. Diesel top-up" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="label-caps mb-1.5 block">Amount (£) *</Label>
                <Input type="number" min={0} step={0.01} value={expenseForm.amount || ""} onChange={(e) => setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) || 0 })} placeholder="0.00" />
              </div>
              <div>
                <Label className="label-caps mb-1.5 block">Date</Label>
                <Input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="label-caps mb-1.5 block">Category</Label>
              <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm({ ...expenseForm, category: v as ExpenseCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EXPENSE_CATEGORIES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="label-caps mb-1.5 block">Notes</Label>
              <Input value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} placeholder="Optional note…" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setExpenseDialogOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleAddExpense} disabled={expenseForm.amount <= 0 || !expenseForm.description.trim()}>
                <Check className="h-3.5 w-3.5 mr-1" /> Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Recurring Expense Dialog */}
      <Dialog open={recurringDialogOpen} onOpenChange={setRecurringDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Recurring Expense</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="label-caps mb-1.5 block">Description *</Label>
              <Input value={recurringForm.description} onChange={(e) => setRecurringForm({ ...recurringForm, description: e.target.value })} placeholder="e.g. Van insurance" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="label-caps mb-1.5 block">Amount (£/month) *</Label>
                <Input type="number" min={0} step={0.01} value={recurringForm.amount || ""} onChange={(e) => setRecurringForm({ ...recurringForm, amount: parseFloat(e.target.value) || 0 })} placeholder="0.00" />
              </div>
              <div>
                <Label className="label-caps mb-1.5 block">Day of Month</Label>
                <Input type="number" min={1} max={28} value={recurringForm.dayOfMonth} onChange={(e) => setRecurringForm({ ...recurringForm, dayOfMonth: Math.min(28, Math.max(1, parseInt(e.target.value) || 1)) })} />
              </div>
            </div>
            <div>
              <Label className="label-caps mb-1.5 block">Category</Label>
              <Select value={recurringForm.category} onValueChange={(v) => setRecurringForm({ ...recurringForm, category: v as ExpenseCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EXPENSE_CATEGORIES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setRecurringDialogOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleAddRecurring} disabled={recurringForm.amount <= 0 || !recurringForm.description.trim()}>
                <Check className="h-3.5 w-3.5 mr-1" /> Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
