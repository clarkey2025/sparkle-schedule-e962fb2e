import { useMemo } from "react";
import { useApp } from "@/lib/AppContext";
import { formatCurrency, formatDate } from "@/lib/helpers";
import PageHeader from "@/components/PageHeader";
import {
  PoundSterling, TrendingUp, TrendingDown, AlertTriangle,
  Users, ArrowUpRight, ArrowDownRight, Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";

export default function FinancePage() {
  const { customers, jobs, payments } = useApp();

  // ─── Computed metrics ──────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const completedJobs = jobs.filter((j) => j.status === "completed");
    const totalRevenue = completedJobs.reduce((s, j) => s + j.price, 0);
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const totalImported = customers.reduce((s, c) => s + (c.importedBalance || 0), 0);
    const totalOutstanding = Math.max(0, totalRevenue - totalPaid + totalImported);
    const avgJobValue = completedJobs.length > 0 ? totalRevenue / completedJobs.length : 0;

    // Customers with debt
    const customerDebts = customers.map((c) => {
      const charged = completedJobs.filter((j) => j.customerId === c.id).reduce((s, j) => s + j.price, 0);
      const paid = payments.filter((p) => p.customerId === c.id).reduce((s, p) => s + p.amount, 0);
      const owed = Math.max(0, charged - paid + (c.importedBalance || 0));
      return { customer: c, owed };
    }).filter((d) => d.owed > 0).sort((a, b) => b.owed - a.owed);

    return { totalRevenue, totalPaid, totalOutstanding, avgJobValue, completedJobs: completedJobs.length, customerDebts };
  }, [customers, jobs, payments]);

  // ─── Monthly revenue trend (last 12 months) ───────────────────────────
  const monthlyRevenue = useMemo(() => {
    const months: { label: string; key: string; revenue: number; payments: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
      const revenue = jobs
        .filter((j) => j.status === "completed" && j.date.startsWith(key))
        .reduce((s, j) => s + j.price, 0);
      const pay = payments
        .filter((p) => p.date.startsWith(key))
        .reduce((s, p) => s + p.amount, 0);
      months.push({ label, key, revenue, payments: pay });
    }
    return months;
  }, [jobs, payments]);

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

  // ─── Payment method breakdown ─────────────────────────────────────────
  const methodBreakdown = useMemo(() => {
    const methods: Record<string, number> = {};
    payments.forEach((p) => {
      const label = p.method.replace("-", " ");
      methods[label] = (methods[label] || 0) + p.amount;
    });
    return Object.entries(methods)
      .map(([method, amount]) => ({ method, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [payments]);

  const methodColors = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

  // ─── Current month vs previous month ──────────────────────────────────
  const monthComparison = useMemo(() => {
    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7);
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = prevDate.toISOString().slice(0, 7);

    const thisRev = jobs
      .filter((j) => j.status === "completed" && j.date.startsWith(thisMonth))
      .reduce((s, j) => s + j.price, 0);
    const prevRev = jobs
      .filter((j) => j.status === "completed" && j.date.startsWith(prevMonth))
      .reduce((s, j) => s + j.price, 0);

    const change = prevRev > 0 ? ((thisRev - prevRev) / prevRev) * 100 : thisRev > 0 ? 100 : 0;
    return { thisRev, prevRev, change };
  }, [jobs]);

  return (
    <>
      <PageHeader
        title="Finances"
        description="Revenue, debt, and payment trends"
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
              label: "Outstanding Debt",
              value: formatCurrency(metrics.totalOutstanding),
              icon: AlertTriangle,
              sub: `${metrics.customerDebts.length} customers owe`,
              colour: metrics.totalOutstanding > 0 ? "text-warning" : "text-success",
            },
            {
              label: "Total Collected",
              value: formatCurrency(metrics.totalPaid),
              icon: PoundSterling,
              sub: `${payments.length} payments`,
              colour: "text-foreground",
            },
            {
              label: "This Month",
              value: formatCurrency(monthComparison.thisRev),
              icon: monthComparison.change >= 0 ? ArrowUpRight : ArrowDownRight,
              sub: monthComparison.change !== 0
                ? `${monthComparison.change > 0 ? "+" : ""}${monthComparison.change.toFixed(0)}% vs last month`
                : "No change",
              colour: monthComparison.change >= 0 ? "text-success" : "text-warning",
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

        {/* ── Charts row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Monthly Revenue vs Payments */}
          <div className="bg-card border border-border rounded-md p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Monthly Revenue & Payments
              </p>
              <p className="text-[11px] text-muted-foreground">Last 12 months</p>
            </div>
            <div className="h-[220px]">
              {monthlyRevenue.some((m) => m.revenue > 0 || m.payments > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyRevenue}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="payGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${v}`} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                      formatter={(value: number, name: string) => [formatCurrency(value), name === "revenue" ? "Revenue" : "Payments"]}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#revGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="payments" stroke="hsl(var(--chart-2))" fill="url(#payGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-[12px]">No revenue data yet</div>
              )}
            </div>
          </div>

          {/* Weekly job volume */}
          <div className="bg-card border border-border rounded-md p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" /> Weekly Jobs Completed
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
                      formatter={(value: number, name: string) => [name === "jobs" ? `${value} jobs` : formatCurrency(value), name === "jobs" ? "Jobs" : "Revenue"]}
                    />
                    <Bar dataKey="jobs" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-[12px]">No job data yet</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Bottom row: Payment methods + Top debtors ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Payment method breakdown */}
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
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: methodColors[i % methodColors.length],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top debtors */}
          <div className="bg-card border border-border rounded-md p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-warning" /> Outstanding Balances
              </p>
              <p className="text-[11px] text-muted-foreground">{metrics.customerDebts.length} customer{metrics.customerDebts.length !== 1 ? "s" : ""}</p>
            </div>
            {metrics.customerDebts.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[12px] text-success">All accounts clear ✓</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
                {metrics.customerDebts.slice(0, 10).map(({ customer, owed }) => (
                  <div key={customer.id} className="flex items-center justify-between rounded-md bg-muted/30 border border-border/50 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-foreground truncate">{customer.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{customer.address}</p>
                    </div>
                    <p className="font-mono text-[13px] font-semibold text-warning shrink-0 ml-3">
                      {formatCurrency(owed)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Avg job value ── */}
        <div className="bg-card border border-border rounded-md p-4 flex items-center justify-between">
          <div>
            <p className="label-caps mb-1">Average Job Value</p>
            <p className="font-mono text-xl font-semibold text-foreground">{formatCurrency(metrics.avgJobValue)}</p>
          </div>
          <div className="text-right">
            <p className="label-caps mb-1">Collection Rate</p>
            <p className={cn(
              "font-mono text-xl font-semibold",
              metrics.totalRevenue > 0 && (metrics.totalPaid / metrics.totalRevenue) >= 0.9 ? "text-success" : "text-warning"
            )}>
              {metrics.totalRevenue > 0 ? ((metrics.totalPaid / metrics.totalRevenue) * 100).toFixed(0) : "0"}%
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
