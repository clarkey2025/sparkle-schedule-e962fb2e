import { useState, useMemo } from "react";
import { useApp } from "@/lib/AppContext";
import { formatCurrency, formatDate } from "@/lib/helpers";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Plus, Trash2, Check, RefreshCw, Search, Receipt,
  Fuel, ShoppingCart, Wrench, Car, Shield, Megaphone, Monitor, MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExpenseCategory } from "@/lib/store";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";

const PAGE_SIZE = 8;

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; icon: typeof Fuel }[] = [
  { value: "fuel", label: "Fuel", icon: Fuel },
  { value: "supplies", label: "Supplies", icon: ShoppingCart },
  { value: "equipment", label: "Equipment", icon: Wrench },
  { value: "vehicle", label: "Vehicle", icon: Car },
  { value: "insurance", label: "Insurance", icon: Shield },
  { value: "marketing", label: "Marketing", icon: Megaphone },
  { value: "software", label: "Software", icon: Monitor },
  { value: "other", label: "Other", icon: MoreHorizontal },
];

const CATEGORY_COLOURS: Record<ExpenseCategory, string> = {
  fuel: "hsl(25 80% 50%)",
  supplies: "hsl(172 50% 45%)",
  equipment: "hsl(45 70% 48%)",
  vehicle: "hsl(210 70% 55%)",
  insurance: "hsl(280 50% 55%)",
  marketing: "hsl(316 80% 44%)",
  software: "hsl(200 60% 50%)",
  other: "hsl(0 0% 42%)",
};

const CATEGORY_BG: Record<ExpenseCategory, string> = {
  fuel: "bg-[hsl(25_95%_53%/0.18)] text-[hsl(25_95%_58%)] border-[hsl(25_95%_53%/0.3)]",
  supplies: "bg-[hsl(172_66%_50%/0.18)] text-[hsl(172_66%_55%)] border-[hsl(172_66%_50%/0.3)]",
  equipment: "bg-[hsl(45_93%_47%/0.18)] text-[hsl(45_93%_55%)] border-[hsl(45_93%_47%/0.3)]",
  vehicle: "bg-[hsl(210_90%_56%/0.18)] text-[hsl(210_90%_64%)] border-[hsl(210_90%_56%/0.3)]",
  insurance: "bg-[hsl(280_70%_55%/0.18)] text-[hsl(280_70%_65%)] border-[hsl(280_70%_55%/0.3)]",
  marketing: "bg-primary/18 text-primary border-primary/30",
  software: "bg-[hsl(200_80%_50%/0.18)] text-[hsl(200_80%_60%)] border-[hsl(200_80%_50%/0.3)]",
  other: "bg-[hsl(0_0%_45%/0.18)] text-[hsl(0_0%_60%)] border-[hsl(0_0%_45%/0.3)]",
};

const emptyExpenseForm = {
  amount: 0,
  date: format(new Date(), "yyyy-MM-dd"),
  category: "fuel" as ExpenseCategory,
  description: "",
  notes: "",
};

function getCategoryMeta(cat: ExpenseCategory) {
  return EXPENSE_CATEGORIES.find((c) => c.value === cat) ?? EXPENSE_CATEGORIES[7];
}

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

  // ── Computed ──
  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);

  const thisMonthTotal = useMemo(() => {
    const key = new Date().toISOString().slice(0, 7);
    return expenses.filter((e) => e.date.startsWith(key)).reduce((s, e) => s + e.amount, 0);
  }, [expenses]);

  const recurringMonthly = useMemo(
    () => recurringExpenses.filter((r) => r.active).reduce((s, r) => s + r.amount, 0),
    [recurringExpenses],
  );

  const categoryBreakdown = useMemo(() => {
    const cats: Record<string, number> = {};
    expenses.forEach((e) => { cats[e.category] = (cats[e.category] || 0) + e.amount; });
    return Object.entries(cats)
      .map(([category, amount]) => ({
        category: category as ExpenseCategory,
        amount,
        meta: getCategoryMeta(category as ExpenseCategory),
      }))
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
        description="Track and manage business costs"
        action={
          <Button size="sm" onClick={() => { setExpenseForm(emptyExpenseForm); setExpenseDialogOpen(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Log Expense
          </Button>
        }
      />

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-3 gap-3 animate-fade-up">
        <div className="bg-card border border-border rounded-md p-4">
          <p className="label-caps mb-2">Total Spent</p>
          <p className="font-mono text-2xl font-medium text-destructive leading-none">{formatCurrency(totalExpenses)}</p>
          <p className="text-[11px] text-muted-foreground mt-2">{expenses.length} expense{expenses.length !== 1 ? "s" : ""} logged</p>
        </div>
        <div className="bg-card border border-border rounded-md p-4">
          <p className="label-caps mb-2">This Month</p>
          <p className="font-mono text-2xl font-medium text-foreground leading-none">{formatCurrency(thisMonthTotal)}</p>
          <p className="text-[11px] text-muted-foreground mt-2">{new Date().toLocaleDateString("en-GB", { month: "long" })}</p>
        </div>
        <div className="bg-card border border-border rounded-md p-4">
          <p className="label-caps mb-2">Recurring</p>
          <p className="font-mono text-2xl font-medium text-warning leading-none">{formatCurrency(recurringMonthly)}</p>
          <p className="text-[11px] text-muted-foreground mt-2">{recurringExpenses.filter((r) => r.active).length} active/month</p>
        </div>
      </div>

      {/* ── Tabs: Log / Recurring ── */}
      <Tabs defaultValue="log" className="animate-fade-up">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="log" className="gap-1.5">
            <Receipt className="h-3.5 w-3.5" /> Expense Log
          </TabsTrigger>
          <TabsTrigger value="recurring" className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Recurring
          </TabsTrigger>
          <TabsTrigger value="breakdown" className="gap-1.5">
            By Category
          </TabsTrigger>
        </TabsList>

        {/* ── Expense Log Tab ── */}
        <TabsContent value="log" className="mt-4 space-y-3">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search expenses…" className="pl-8 h-8 text-xs" />
            </div>
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {paginated.length === 0 ? (
            <div className="surface rounded-md p-10 text-center">
              <Receipt className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{expenses.length === 0 ? "No expenses logged yet — add one to get started." : "No matching expenses."}</p>
            </div>
          ) : (
            <>
              <div className="bg-card border border-border rounded-md divide-y divide-border overflow-hidden">
                {paginated.map((e) => {
                  const meta = getCategoryMeta(e.category);
                  const Icon = meta.icon;
                  return (
                    <div key={e.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-muted/20 transition-colors">
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-md border shrink-0",
                        CATEGORY_BG[e.category] || "bg-muted text-muted-foreground border-border"
                      )}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">{e.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-muted-foreground">{formatDate(e.date)}</span>
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 uppercase tracking-wider">
                            {meta.label}
                          </Badge>
                          {e.notes && <span className="text-[11px] text-muted-foreground/60 truncate max-w-[200px]">{e.notes}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <p className="font-mono text-sm font-semibold text-destructive">−{formatCurrency(e.amount)}</p>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          onClick={() => { deleteExpense(e.id); toast({ title: "Expense deleted" }); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-1">
                  <p className="text-[12px] text-muted-foreground">
                    {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </p>
                  <Pagination className="w-auto mx-0">
                    <PaginationContent>
                      <PaginationItem><PaginationPrevious onClick={() => setPage((p) => Math.max(1, p - 1))} className={safePage === 1 ? "pointer-events-none opacity-40" : "cursor-pointer"} /></PaginationItem>
                      <PaginationItem><span className="text-[12px] text-muted-foreground px-3 py-2 tabular-nums">{safePage} / {totalPages}</span></PaginationItem>
                      <PaginationItem><PaginationNext onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className={safePage === totalPages ? "pointer-events-none opacity-40" : "cursor-pointer"} /></PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Recurring Tab ── */}
        <TabsContent value="recurring" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-foreground">
              {recurringExpenses.filter((r) => r.active).length} active · {formatCurrency(recurringMonthly)}/month
            </p>
            <Button size="sm" variant="outline" onClick={() => {
              setRecurringForm({ amount: 0, category: "insurance", description: "", dayOfMonth: 1 });
              setRecurringDialogOpen(true);
            }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Recurring
            </Button>
          </div>

          {recurringExpenses.length === 0 ? (
            <div className="surface rounded-md p-10 text-center">
              <RefreshCw className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No recurring expenses set up yet.</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">Add monthly bills like insurance, software, van finance.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-md divide-y divide-border overflow-hidden">
              {recurringExpenses.map((re) => {
                const meta = getCategoryMeta(re.category);
                const Icon = meta.icon;
                return (
                  <div key={re.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-muted/20 transition-colors">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md border shrink-0",
                      re.active
                        ? (CATEGORY_BG[re.category] || "bg-muted text-muted-foreground border-border")
                        : "bg-muted/30 text-muted-foreground/40 border-border/50"
                    )}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-[13px] font-medium truncate", re.active ? "text-foreground" : "text-muted-foreground line-through")}>{re.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 uppercase tracking-wider">{meta.label}</Badge>
                        <span className="text-[11px] text-muted-foreground">Day {re.dayOfMonth} each month</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className={cn("font-mono text-sm font-semibold", re.active ? "text-destructive" : "text-muted-foreground")}>
                        {formatCurrency(re.amount)}<span className="text-[10px] font-normal text-muted-foreground">/mo</span>
                      </p>
                      <Switch checked={re.active} onCheckedChange={(checked) => updateRecurringExpense(re.id, { active: checked })} />
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={() => { deleteRecurringExpense(re.id); toast({ title: "Recurring expense removed" }); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Category Breakdown Tab ── */}
        <TabsContent value="breakdown" className="mt-4 space-y-3">
          {categoryBreakdown.length === 0 ? (
            <div className="surface rounded-md p-10 text-center">
              <p className="text-sm text-muted-foreground">No expenses to break down yet.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-md p-5 space-y-4">
              {categoryBreakdown.map(({ category, amount, meta }) => {
                const pct = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
                const Icon = meta.icon;
                return (
                  <div key={category} className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md border shrink-0",
                      CATEGORY_BG[category] || "bg-muted text-muted-foreground border-border"
                    )}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[13px] font-medium text-foreground">{meta.label}</p>
                        <p className="text-[12px] text-muted-foreground font-mono">{formatCurrency(amount)} <span className="text-muted-foreground/50">({pct.toFixed(0)}%)</span></p>
                      </div>
                      <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLOURS[category] }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Add Expense Dialog ── */}
      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Log Expense</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
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
              <div className="grid grid-cols-4 gap-1.5">
                {EXPENSE_CATEGORIES.map((c) => {
                  const Icon = c.icon;
                  const active = expenseForm.category === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setExpenseForm({ ...expenseForm, category: c.value })}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-md border px-2 py-2.5 text-[10px] font-medium transition-all",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label className="label-caps mb-1.5 block">Notes</Label>
              <Input value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} placeholder="Optional note…" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setExpenseDialogOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleAddExpense} disabled={expenseForm.amount <= 0 || !expenseForm.description.trim()}>
                <Check className="h-3.5 w-3.5 mr-1" /> Save Expense
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add Recurring Dialog ── */}
      <Dialog open={recurringDialogOpen} onOpenChange={setRecurringDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Recurring Expense</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
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
              <div className="grid grid-cols-4 gap-1.5">
                {EXPENSE_CATEGORIES.map((c) => {
                  const Icon = c.icon;
                  const active = recurringForm.category === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setRecurringForm({ ...recurringForm, category: c.value })}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-md border px-2 py-2.5 text-[10px] font-medium transition-all",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
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
