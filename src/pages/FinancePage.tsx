import { useMemo, useState } from "react";
import { useApp } from "@/lib/AppContext";
import { formatCurrency, formatDate } from "@/lib/helpers";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  PoundSterling, TrendingUp, AlertTriangle,
  Users, ArrowUpRight, ArrowDownRight, Receipt,
  Plus, Trash2, Minus, Check, RefreshCw, Car, Fuel, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import type { Expense, ExpenseCategory, RecurringExpense, MileageEntry, FuelSettings } from "@/lib/store";
import { calculateFuelCost } from "@/lib/store";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

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

export default function FinancePage() {
  const {
    customers, jobs, payments, expenses, addExpense, deleteExpense,
    recurringExpenses, addRecurringExpense, updateRecurringExpense, deleteRecurringExpense,
    mileageEntries, fuelSettings, addMileageEntry, deleteMileageEntry, updateFuelSettings,
  } = useApp();
  const { toast } = useToast();
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [mileageDialogOpen, setMileageDialogOpen] = useState(false);
  const [fuelSettingsOpen, setFuelSettingsOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);
  const [recurringForm, setRecurringForm] = useState({
    amount: 0, category: "insurance" as ExpenseCategory, description: "", dayOfMonth: 1,
  });
  const [mileageForm, setMileageForm] = useState({
    date: format(new Date(), "yyyy-MM-dd"), miles: 0, notes: "",
  });

  // ─── Computed metrics ──────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const completedJobs = jobs.filter((j) => j.status === "completed");
    const totalRevenue = completedJobs.reduce((s, j) => s + j.price, 0);
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const totalImported = customers.reduce((s, c) => s + (c.importedBalance || 0), 0);
    const totalOutstanding = Math.max(0, totalRevenue - totalPaid + totalImported);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const netProfit = totalRevenue - totalExpenses;
    const avgJobValue = completedJobs.length > 0 ? totalRevenue / completedJobs.length : 0;

    const customerDebts = customers.map((c) => {
      const charged = completedJobs.filter((j) => j.customerId === c.id).reduce((s, j) => s + j.price, 0);
      const paid = payments.filter((p) => p.customerId === c.id).reduce((s, p) => s + p.amount, 0);
      const owed = Math.max(0, charged - paid + (c.importedBalance || 0));
      return { customer: c, owed };
    }).filter((d) => d.owed > 0).sort((a, b) => b.owed - a.owed);

    return { totalRevenue, totalPaid, totalOutstanding, totalExpenses, netProfit, avgJobValue, completedJobs: completedJobs.length, customerDebts };
  }, [customers, jobs, payments, expenses]);

  // ─── Monthly P&L trend (last 12 months) ───────────────────────────────
  const monthlyPL = useMemo(() => {
    const months: { label: string; key: string; revenue: number; expenses: number; profit: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
      const revenue = jobs
        .filter((j) => j.status === "completed" && j.date.startsWith(key))
        .reduce((s, j) => s + j.price, 0);
      const exp = expenses
        .filter((e) => e.date.startsWith(key))
        .reduce((s, e) => s + e.amount, 0);
      months.push({ label, key, revenue, expenses: exp, profit: revenue - exp });
    }
    return months;
  }, [jobs, expenses]);

  // ─── Weekly trend (last 8 weeks) ──────────────────────────────────────
  const weeklyData = useMemo(() => {
    const weeks: { label: string; jobs: number; revenue: number }[] = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7 + now.getDay()));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const startStr = weekStart.toISOString().slice(0, 10);
      const endStr = weekEnd.toISOString().slice(0, 10);
      const label = weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      const weekJobs = jobs.filter(
        (j) => j.status === "completed" && j.date >= startStr && j.date <= endStr
      );
      weeks.push({
        label,
        jobs: weekJobs.length,
        revenue: weekJobs.reduce((s, j) => s + j.price, 0),
      });
    }
    return weeks;
  }, [jobs]);

  // ─── Expense category breakdown ───────────────────────────────────────
  const categoryBreakdown = useMemo(() => {
    const cats: Record<string, number> = {};
    expenses.forEach((e) => { cats[e.category] = (cats[e.category] || 0) + e.amount; });
    return Object.entries(cats)
      .map(([category, amount]) => ({ category, amount, label: EXPENSE_CATEGORIES.find((c) => c.value === category)?.label || category }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  // ─── This month vs last month ─────────────────────────────────────────
  const monthComparison = useMemo(() => {
    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7);
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = prevDate.toISOString().slice(0, 7);

    const thisRev = jobs.filter((j) => j.status === "completed" && j.date.startsWith(thisMonth)).reduce((s, j) => s + j.price, 0);
    const thisExp = expenses.filter((e) => e.date.startsWith(thisMonth)).reduce((s, e) => s + e.amount, 0);
    const prevRev = jobs.filter((j) => j.status === "completed" && j.date.startsWith(prevMonth)).reduce((s, j) => s + j.price, 0);

    const thisProfit = thisRev - thisExp;
    const change = prevRev > 0 ? ((thisRev - prevRev) / prevRev) * 100 : thisRev > 0 ? 100 : 0;
    return { thisRev, thisExp, thisProfit, change };
  }, [jobs, expenses]);

  // ─── Payment method breakdown ─────────────────────────────────────────
  const methodBreakdown = useMemo(() => {
    const methods: Record<string, number> = {};
    payments.forEach((p) => { methods[p.method.replace("-", " ")] = (methods[p.method.replace("-", " ")] || 0) + p.amount; });
    return Object.entries(methods).map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount);
  }, [payments]);

  const methodColors = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

  // ─── Recent expenses ──────────────────────────────────────────────────
  const recentExpenses = useMemo(() =>
    [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15),
    [expenses]
  );

  // ─── Mileage metrics ──────────────────────────────────────────────────
  const mileageMetrics = useMemo(() => {
    const totalMiles = mileageEntries.reduce((s, m) => s + m.miles, 0);
    const totalFuelCost = calculateFuelCost(totalMiles, fuelSettings);
    const thisMonth = new Date().toISOString().slice(0, 7);
    const thisMonthMiles = mileageEntries.filter((m) => m.date.startsWith(thisMonth)).reduce((s, m) => s + m.miles, 0);
    const thisMonthFuel = calculateFuelCost(thisMonthMiles, fuelSettings);
    const recentEntries = [...mileageEntries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
    return { totalMiles, totalFuelCost, thisMonthMiles, thisMonthFuel, recentEntries };
  }, [mileageEntries, fuelSettings]);

  // ─── Handlers ─────────────────────────────────────────────────────────
  const handleAddExpense = () => {
    if (expenseForm.amount <= 0 || !expenseForm.description.trim()) return;
    addExpense({
      amount: expenseForm.amount,
      date: expenseForm.date,
      category: expenseForm.category,
      description: expenseForm.description.trim(),
      notes: expenseForm.notes.trim(),
    });
    toast({ title: "Expense logged", description: `${formatCurrency(expenseForm.amount)} — ${expenseForm.description}` });
    setExpenseForm(emptyExpenseForm);
    setExpenseDialogOpen(false);
  };

  const handleAddRecurring = () => {
    if (recurringForm.amount <= 0 || !recurringForm.description.trim()) return;
    addRecurringExpense({
      amount: recurringForm.amount,
      category: recurringForm.category,
      description: recurringForm.description.trim(),
      dayOfMonth: recurringForm.dayOfMonth,
      active: true,
    });
    toast({ title: "Recurring expense added", description: `${formatCurrency(recurringForm.amount)}/month — ${recurringForm.description}` });
    setRecurringForm({ amount: 0, category: "insurance", description: "", dayOfMonth: 1 });
    setRecurringDialogOpen(false);
  };

  const handleAddMileage = () => {
    if (mileageForm.miles <= 0) return;
    addMileageEntry({
      date: mileageForm.date,
      miles: mileageForm.miles,
      notes: mileageForm.notes.trim(),
    });
    const fuelCost = calculateFuelCost(mileageForm.miles, fuelSettings);
    toast({ title: "Mileage logged", description: `${mileageForm.miles} miles — est. fuel ${formatCurrency(fuelCost)}` });
    setMileageForm({ date: format(new Date(), "yyyy-MM-dd"), miles: 0, notes: "" });
    setMileageDialogOpen(false);
  };

  return (
    <>
      <PageHeader
        title="Finances"
        description="Profit & loss, expenses, and payment trends"
      />

      <div className="space-y-6 pb-24">
        {/* ── Top stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: "Total Revenue",
              value: formatCurrency(metrics.totalRevenue),
              icon: TrendingUp,
              sub: `${metrics.completedJobs} completed jobs`,
              colour: "text-success",
            },
            {
              label: "Total Expenses",
              value: formatCurrency(metrics.totalExpenses),
              icon: Minus,
              sub: `${expenses.length} expenses logged`,
              colour: "text-destructive",
            },
            {
              label: "Net Profit",
              value: formatCurrency(Math.abs(metrics.netProfit)),
              icon: metrics.netProfit >= 0 ? ArrowUpRight : ArrowDownRight,
              sub: metrics.netProfit >= 0 ? "Profitable" : "Loss",
              colour: metrics.netProfit >= 0 ? "text-success" : "text-destructive",
            },
            {
              label: "Outstanding Debt",
              value: formatCurrency(metrics.totalOutstanding),
              icon: AlertTriangle,
              sub: `${metrics.customerDebts.length} customers owe`,
              colour: metrics.totalOutstanding > 0 ? "text-warning" : "text-success",
            },
          ].map(({ label, value, icon: Icon, sub, colour }) => (
            <div key={label} className="bg-card border border-border rounded-md p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="label-caps">{label}</p>
                <Icon className={cn("h-4 w-4", colour)} />
              </div>
              <p className={cn("font-mono text-xl font-semibold", colour)}>{value}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* ── Tabs: P&L / Expenses / Overview ── */}
        <Tabs defaultValue="pnl" className="space-y-4">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="pnl">Profit & Loss</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="mileage">Mileage</TabsTrigger>
            <TabsTrigger value="overview">Revenue</TabsTrigger>
          </TabsList>

          {/* ── P&L Tab ── */}
          <TabsContent value="pnl" className="space-y-4 mt-0">
            {/* Monthly P&L chart */}
            <div className="bg-card border border-border rounded-md p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Monthly Profit & Loss
                </p>
                <p className="text-[11px] text-muted-foreground">Last 12 months</p>
              </div>
              <div className="h-[260px]">
                {monthlyPL.some((m) => m.revenue > 0 || m.expenses > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyPL}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${v}`} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                        formatter={(value: number, name: string) => [
                          formatCurrency(value),
                          name === "revenue" ? "Revenue" : name === "expenses" ? "Expenses" : "Profit",
                        ]}
                      />
                      <Bar dataKey="revenue" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} name="revenue" />
                      <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="expenses" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-[12px]">No data yet</div>
                )}
              </div>
            </div>

            {/* This month summary + margin */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="bg-card border border-border rounded-md p-4">
                <p className="label-caps mb-1">This Month Revenue</p>
                <p className="font-mono text-xl font-semibold text-success">{formatCurrency(monthComparison.thisRev)}</p>
                {monthComparison.change !== 0 && (
                  <p className={cn("text-[11px] mt-1", monthComparison.change > 0 ? "text-success" : "text-warning")}>
                    {monthComparison.change > 0 ? "+" : ""}{monthComparison.change.toFixed(0)}% vs last month
                  </p>
                )}
              </div>
              <div className="bg-card border border-border rounded-md p-4">
                <p className="label-caps mb-1">This Month Expenses</p>
                <p className="font-mono text-xl font-semibold text-destructive">{formatCurrency(monthComparison.thisExp)}</p>
              </div>
              <div className="bg-card border border-border rounded-md p-4">
                <p className="label-caps mb-1">This Month Profit</p>
                <p className={cn("font-mono text-xl font-semibold", monthComparison.thisProfit >= 0 ? "text-success" : "text-destructive")}>
                  {formatCurrency(Math.abs(monthComparison.thisProfit))}
                </p>
                {metrics.totalRevenue > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {((metrics.netProfit / metrics.totalRevenue) * 100).toFixed(0)}% overall margin
                  </p>
                )}
              </div>
            </div>

            {/* Expense by category + debtors */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-md p-4">
                <p className="text-[13px] font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Minus className="h-4 w-4 text-destructive" /> Expenses by Category
                </p>
                {categoryBreakdown.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground py-8 text-center">No expenses logged yet.</p>
                ) : (
                  <div className="space-y-3">
                    {categoryBreakdown.map(({ category, amount, label }) => {
                      const pct = metrics.totalExpenses > 0 ? (amount / metrics.totalExpenses) * 100 : 0;
                      return (
                        <div key={category}>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[12px] font-medium text-foreground capitalize">{label}</p>
                            <p className="text-[11px] text-muted-foreground font-mono">{formatCurrency(amount)} ({pct.toFixed(0)}%)</p>
                          </div>
                          <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLOURS[category as ExpenseCategory] || "hsl(var(--muted-foreground))" }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-card border border-border rounded-md p-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                    <Users className="h-4 w-4 text-warning" /> Outstanding Balances
                  </p>
                  <p className="text-[11px] text-muted-foreground">{metrics.customerDebts.length} customer{metrics.customerDebts.length !== 1 ? "s" : ""}</p>
                </div>
                {metrics.customerDebts.length === 0 ? (
                  <div className="py-8 text-center"><p className="text-[12px] text-success">All accounts clear ✓</p></div>
                ) : (
                  <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
                    {metrics.customerDebts.slice(0, 10).map(({ customer, owed }) => (
                      <div key={customer.id} className="flex items-center justify-between rounded-md bg-muted/30 border border-border/50 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-foreground truncate">{customer.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{customer.address}</p>
                        </div>
                        <p className="font-mono text-[13px] font-semibold text-warning shrink-0 ml-3">{formatCurrency(owed)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── Expenses Tab ── */}
          <TabsContent value="expenses" className="space-y-4 mt-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-foreground">Expense Log</p>
                <p className="text-[11px] text-muted-foreground">{expenses.length} expenses · {formatCurrency(metrics.totalExpenses)} total</p>
              </div>
              <Button size="sm" onClick={() => { setExpenseForm(emptyExpenseForm); setExpenseDialogOpen(true); }}>
                <Plus className="h-3.5 w-3.5" /> Log Expense
              </Button>
            </div>

            {recentExpenses.length === 0 ? (
              <div className="bg-card border border-border rounded-md py-12 text-center">
                <p className="text-[12px] text-muted-foreground">No expenses logged yet.</p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">Track fuel, supplies, insurance, and more.</p>
                <Button size="sm" variant="outline" className="mt-4" onClick={() => { setExpenseForm(emptyExpenseForm); setExpenseDialogOpen(true); }}>
                  <Plus className="h-3.5 w-3.5" /> Log your first expense
                </Button>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-md divide-y divide-border">
                {recentExpenses.map((e) => (
                  <div key={e.id} className="flex items-center justify-between px-4 py-3 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: CATEGORY_COLOURS[e.category] }}
                      />
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
                      <Button
                        variant="ghost" size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive/60 hover:text-destructive"
                        onClick={() => { deleteExpense(e.id); toast({ title: "Expense deleted" }); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recurring Expenses */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[13px] font-semibold text-foreground flex items-center gap-2">
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
                  <Plus className="h-3.5 w-3.5" /> Add Recurring
                </Button>
              </div>

              {recurringExpenses.length === 0 ? (
                <div className="bg-card border border-border rounded-md py-8 text-center">
                  <p className="text-[12px] text-muted-foreground">No recurring expenses set up.</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">Add monthly bills like insurance, software subscriptions, van finance.</p>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-md divide-y divide-border">
                  {recurringExpenses.map((re) => (
                    <div key={re.id} className="flex items-center justify-between px-4 py-3 group">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: CATEGORY_COLOURS[re.category] }}
                        />
                        <div className="min-w-0">
                          <p className={cn("text-[12px] font-medium truncate", re.active ? "text-foreground" : "text-muted-foreground line-through")}>{re.description}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">
                            {EXPENSE_CATEGORIES.find((c) => c.value === re.category)?.label} · Day {re.dayOfMonth} of each month
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <p className={cn("font-mono text-[13px] font-medium", re.active ? "text-destructive" : "text-muted-foreground")}>
                          {formatCurrency(re.amount)}/mo
                        </p>
                        <Switch
                          checked={re.active}
                          onCheckedChange={(checked) => updateRecurringExpense(re.id, { active: checked })}
                          className="scale-75"
                        />
                        <Button
                          variant="ghost" size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive/60 hover:text-destructive"
                          onClick={() => { deleteRecurringExpense(re.id); toast({ title: "Recurring expense removed" }); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Revenue Tab ── */}
          <TabsContent value="overview" className="space-y-4 mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Monthly Revenue vs Payments */}
              <div className="bg-card border border-border rounded-md p-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" /> Revenue & Collections
                  </p>
                  <p className="text-[11px] text-muted-foreground">Last 12 months</p>
                </div>
                <div className="h-[220px]">
                  {monthlyPL.some((m) => m.revenue > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyPL}>
                        <defs>
                          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${v}`} />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                          formatter={(value: number) => [formatCurrency(value)]}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#revGrad)" strokeWidth={2} name="Revenue" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-[12px]">No revenue data yet</div>
                  )}
                </div>
              </div>

              {/* Weekly jobs */}
              <div className="bg-card border border-border rounded-md p-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-primary" /> Weekly Jobs
                  </p>
                  <p className="text-[11px] text-muted-foreground">Last 8 weeks</p>
                </div>
                <div className="h-[220px]">
                  {weeklyData.some((w) => w.jobs > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                          formatter={(value: number) => [`${value} jobs`]}
                        />
                        <Bar dataKey="jobs" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Jobs" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-[12px]">No job data yet</div>
                  )}
                </div>
              </div>
            </div>

            {/* Payment methods + summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-md p-4">
                <p className="text-[13px] font-semibold text-foreground mb-4 flex items-center gap-2">
                  <PoundSterling className="h-4 w-4 text-primary" /> Payment Methods
                </p>
                {methodBreakdown.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground py-8 text-center">No payments recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {methodBreakdown.map(({ method, amount }, i) => {
                      const pct = metrics.totalPaid > 0 ? (amount / metrics.totalPaid) * 100 : 0;
                      return (
                        <div key={method}>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[12px] font-medium text-foreground capitalize">{method}</p>
                            <p className="text-[11px] text-muted-foreground font-mono">{formatCurrency(amount)} ({pct.toFixed(0)}%)</p>
                          </div>
                          <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: methodColors[i % methodColors.length] }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-card border border-border rounded-md p-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="label-caps">Average Job Value</p>
                    <p className="font-mono text-lg font-semibold text-foreground">{formatCurrency(metrics.avgJobValue)}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="label-caps">Collection Rate</p>
                    <p className={cn(
                      "font-mono text-lg font-semibold",
                      metrics.totalRevenue > 0 && (metrics.totalPaid / metrics.totalRevenue) >= 0.9 ? "text-success" : "text-warning"
                    )}>
                      {metrics.totalRevenue > 0 ? ((metrics.totalPaid / metrics.totalRevenue) * 100).toFixed(0) : "0"}%
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="label-caps">Profit Margin</p>
                    <p className={cn(
                      "font-mono text-lg font-semibold",
                      metrics.netProfit >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {metrics.totalRevenue > 0 ? ((metrics.netProfit / metrics.totalRevenue) * 100).toFixed(0) : "0"}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Add Expense Dialog ── */}
      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border border-border">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Log Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="label-caps mb-1.5 block">Description *</Label>
              <Input
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                placeholder="e.g. Diesel top-up"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="label-caps mb-1.5 block">Amount (£) *</Label>
                <Input
                  type="number" min={0} step={0.01}
                  value={expenseForm.amount || ""}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label className="label-caps mb-1.5 block">Date</Label>
                <Input
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="label-caps mb-1.5 block">Category</Label>
              <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm({ ...expenseForm, category: v as ExpenseCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="label-caps mb-1.5 block">Notes</Label>
              <Input
                value={expenseForm.notes}
                onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                placeholder="Optional note…"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setExpenseDialogOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleAddExpense} disabled={expenseForm.amount <= 0 || !expenseForm.description.trim()}>
                <Check className="h-3.5 w-3.5" /> Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add Recurring Expense Dialog ── */}
      <Dialog open={recurringDialogOpen} onOpenChange={setRecurringDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border border-border">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Add Recurring Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="label-caps mb-1.5 block">Description *</Label>
              <Input
                value={recurringForm.description}
                onChange={(e) => setRecurringForm({ ...recurringForm, description: e.target.value })}
                placeholder="e.g. Van insurance"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="label-caps mb-1.5 block">Amount (£/month) *</Label>
                <Input
                  type="number" min={0} step={0.01}
                  value={recurringForm.amount || ""}
                  onChange={(e) => setRecurringForm({ ...recurringForm, amount: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label className="label-caps mb-1.5 block">Day of Month</Label>
                <Input
                  type="number" min={1} max={28}
                  value={recurringForm.dayOfMonth}
                  onChange={(e) => setRecurringForm({ ...recurringForm, dayOfMonth: Math.min(28, Math.max(1, parseInt(e.target.value) || 1)) })}
                />
              </div>
            </div>
            <div>
              <Label className="label-caps mb-1.5 block">Category</Label>
              <Select value={recurringForm.category} onValueChange={(v) => setRecurringForm({ ...recurringForm, category: v as ExpenseCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setRecurringDialogOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleAddRecurring} disabled={recurringForm.amount <= 0 || !recurringForm.description.trim()}>
                <Check className="h-3.5 w-3.5" /> Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
