import { useMemo } from "react";
import { useApp } from "@/lib/AppContext";
import { formatCurrency } from "@/lib/helpers";
import PageHeader from "@/components/PageHeader";
import {
  PoundSterling, TrendingUp, AlertTriangle,
  Users, ArrowUpRight, ArrowDownRight, Receipt, Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

export default function FinancePage() {
  const { customers, jobs, payments, expenses } = useApp();

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

  const monthlyPL = useMemo(() => {
    const months: { label: string; key: string; revenue: number; expenses: number; profit: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
      const revenue = jobs.filter((j) => j.status === "completed" && j.date.startsWith(key)).reduce((s, j) => s + j.price, 0);
      const exp = expenses.filter((e) => e.date.startsWith(key)).reduce((s, e) => s + e.amount, 0);
      months.push({ label, key, revenue, expenses: exp, profit: revenue - exp });
    }
    return months;
  }, [jobs, expenses]);

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
      const weekJobs = jobs.filter((j) => j.status === "completed" && j.date >= startStr && j.date <= endStr);
      weeks.push({ label, jobs: weekJobs.length, revenue: weekJobs.reduce((s, j) => s + j.price, 0) });
    }
    return weeks;
  }, [jobs]);

  const methodBreakdown = useMemo(() => {
    const methods: Record<string, number> = {};
    payments.forEach((p) => { methods[p.method.replace("-", " ")] = (methods[p.method.replace("-", " ")] || 0) + p.amount; });
    return Object.entries(methods).map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount);
  }, [payments]);

  const methodColors = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

  return (
    <div className="pb-20 md:pb-0 space-y-5">
      <PageHeader title="Finances" description="Profit & loss overview and revenue trends" />

      {/* Top stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-up">
        {[
          { label: "Total Revenue", value: formatCurrency(metrics.totalRevenue), icon: TrendingUp, sub: `${metrics.completedJobs} completed jobs`, colour: "text-success" },
          { label: "Total Expenses", value: formatCurrency(metrics.totalExpenses), icon: Minus, sub: `across all categories`, colour: "text-destructive" },
          { label: "Net Profit", value: formatCurrency(Math.abs(metrics.netProfit)), icon: metrics.netProfit >= 0 ? ArrowUpRight : ArrowDownRight, sub: metrics.netProfit >= 0 ? "Profitable" : "Loss", colour: metrics.netProfit >= 0 ? "text-success" : "text-destructive" },
          { label: "Outstanding Debt", value: formatCurrency(metrics.totalOutstanding), icon: AlertTriangle, sub: `${metrics.customerDebts.length} customers owe`, colour: metrics.totalOutstanding > 0 ? "text-warning" : "text-success" },
        ].map(({ label, value, icon: Icon, sub, colour }) => (
          <div key={label} className="bg-card border border-border rounded-md p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="label-caps">{label}</p>
              <Icon className={cn("h-4 w-4", colour)} />
            </div>
            <p className={cn("font-mono text-xl font-medium", colour)}>{value}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Monthly P&L chart */}
      <div className="bg-card border border-border rounded-md p-4 animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[13px] font-medium text-foreground flex items-center gap-2">
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
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} formatter={(value: number, name: string) => [formatCurrency(value), name === "revenue" ? "Revenue" : name === "expenses" ? "Expenses" : "Profit"]} />
                <Bar dataKey="revenue" fill="hsl(152 50% 55% / 0.6)" radius={[4, 4, 0, 0]} name="revenue" />
                <Bar dataKey="expenses" fill="hsl(0 62% 60% / 0.5)" radius={[4, 4, 0, 0]} name="expenses" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-[12px]">No data yet</div>
          )}
        </div>
      </div>

      {/* This month + debtors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-up">
        {/* This month summary */}
        <div className="space-y-3">
          <div className="bg-card border border-border rounded-md p-4">
            <p className="label-caps mb-1">This Month Revenue</p>
            <p className="font-mono text-xl font-medium text-success">{formatCurrency(monthComparison.thisRev)}</p>
            {monthComparison.change !== 0 && (
              <p className={cn("text-[11px] mt-1", monthComparison.change > 0 ? "text-success" : "text-warning")}>
                {monthComparison.change > 0 ? "+" : ""}{monthComparison.change.toFixed(0)}% vs last month
              </p>
            )}
          </div>
          <div className="bg-card border border-border rounded-md p-4">
            <p className="label-caps mb-1">This Month Expenses</p>
            <p className="font-mono text-xl font-medium text-destructive">{formatCurrency(monthComparison.thisExp)}</p>
          </div>
          <div className="bg-card border border-border rounded-md p-4">
            <p className="label-caps mb-1">This Month Profit</p>
            <p className={cn("font-mono text-xl font-medium", monthComparison.thisProfit >= 0 ? "text-success" : "text-destructive")}>
              {formatCurrency(Math.abs(monthComparison.thisProfit))}
            </p>
            {metrics.totalRevenue > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">{((metrics.netProfit / metrics.totalRevenue) * 100).toFixed(0)}% overall margin</p>
            )}
          </div>
        </div>

        {/* Outstanding balances */}
        <div className="bg-card border border-border rounded-md p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-medium text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-warning" /> Outstanding Balances
            </p>
            <p className="text-[11px] text-muted-foreground">{metrics.customerDebts.length} customer{metrics.customerDebts.length !== 1 ? "s" : ""}</p>
          </div>
          {metrics.customerDebts.length === 0 ? (
            <div className="py-8 text-center"><p className="text-[12px] text-success">All accounts clear ✓</p></div>
          ) : (
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
              {metrics.customerDebts.slice(0, 15).map(({ customer, owed }) => (
                <div key={customer.id} className="flex items-center justify-between rounded-md bg-muted/30 border border-border/50 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-foreground truncate">{customer.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{customer.address}</p>
                  </div>
                  <p className="font-mono text-[13px] font-medium text-warning shrink-0 ml-3">{formatCurrency(owed)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Revenue & Weekly jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-up">
        <div className="bg-card border border-border rounded-md p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-medium text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Revenue Trend
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
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} formatter={(value: number) => [formatCurrency(value)]} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#revGrad)" strokeWidth={2} name="Revenue" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-[12px]">No revenue data yet</div>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-md p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-medium text-foreground flex items-center gap-2">
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
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} formatter={(value: number) => [`${value} jobs`]} />
                  <Bar dataKey="jobs" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Jobs" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-[12px]">No job data yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Payment methods + KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-up">
        <div className="bg-card border border-border rounded-md p-4">
          <p className="text-[13px] font-medium text-foreground mb-4 flex items-center gap-2">
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
              <p className="font-mono text-lg font-medium text-foreground">{formatCurrency(metrics.avgJobValue)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="label-caps">Collection Rate</p>
              <p className={cn("font-mono text-lg font-medium", metrics.totalRevenue > 0 && (metrics.totalPaid / metrics.totalRevenue) >= 0.9 ? "text-success" : "text-warning")}>
                {metrics.totalRevenue > 0 ? ((metrics.totalPaid / metrics.totalRevenue) * 100).toFixed(0) : "0"}%
              </p>
            </div>
            <div className="flex items-center justify-between">
              <p className="label-caps">Profit Margin</p>
              <p className={cn("font-mono text-lg font-medium", metrics.netProfit >= 0 ? "text-success" : "text-destructive")}>
                {metrics.totalRevenue > 0 ? ((metrics.netProfit / metrics.totalRevenue) * 100).toFixed(0) : "0"}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
