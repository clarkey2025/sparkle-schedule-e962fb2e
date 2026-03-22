import { useMemo } from "react";
import { useApp } from "@/lib/AppContext";
import { formatCurrency, formatDate, getNextDueDate, FREQUENCY_LABELS } from "@/lib/helpers";
import { Users, CalendarCheck, PoundSterling, AlertTriangle, Clock, ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  delay,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent?: "pink" | "success" | "warning" | "default";
  delay?: string;
}) {
  const iconColors: Record<string, string> = {
    pink: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    default: "text-muted-foreground bg-muted",
  };
  const a = accent ?? "default";
  return (
    <div
      className="surface rounded-md p-5 animate-fade-up"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-caps mb-2">{label}</p>
          <p className="font-mono text-2xl font-medium tracking-tight text-foreground">{value}</p>
          {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
        </div>
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded", iconColors[a])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="label-caps mb-3">{children}</h2>
  );
}

export default function Dashboard() {
  const { customers, jobs, payments } = useApp();
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);
    const completedJobs = jobs.filter((j) => j.status === "completed");
    const totalOwed = completedJobs.reduce((s, j) => s + j.price, 0) - totalRevenue;

    const now = new Date();

    const overdueCustomers = customers.filter((c) => {
      const lastJob = jobs
        .filter((j) => j.customerId === c.id && j.status === "completed")
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      const due = getNextDueDate(lastJob?.date, c.frequency);
      return due < now;
    });

    // Customers with a next clean date coming soon (within 7 days)
    const soonCustomers = customers
      .filter((c) => !overdueCustomers.includes(c))
      .map((c) => {
        const lastJob = jobs
          .filter((j) => j.customerId === c.id && j.status === "completed")
          .sort((a, b) => b.date.localeCompare(a.date))[0];
        const due = getNextDueDate(lastJob?.date, c.frequency);
        return { customer: c, due };
      })
      .filter(({ due }) => {
        const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diff <= 7 && diff >= 0;
      })
      .sort((a, b) => a.due.getTime() - b.due.getTime());

    const upcoming = jobs
      .filter((j) => j.status === "scheduled")
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 6);

    const thisMonthPayments = payments.filter((p) => {
      const d = new Date(p.date);
      const n = new Date();
      return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
    });
    const monthRevenue = thisMonthPayments.reduce((s, p) => s + p.amount, 0);

    return {
      totalRevenue,
      totalOwed: Math.max(0, totalOwed),
      overdueCount: overdueCustomers.length,
      upcoming,
      overdueCustomers,
      soonCustomers,
      monthRevenue,
      completedCount: completedJobs.length,
    };
  }, [customers, jobs, payments]);

  const now = new Date();

  return (
    <div className="pb-20 md:pb-0 space-y-8">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Customers" value={String(customers.length)} icon={Users} accent="default" delay="0.04s" />
        <StatCard label="Jobs Completed" value={String(stats.completedCount)} icon={CheckCircle2} accent="success" delay="0.08s" sub="all time" />
        <StatCard label="This Month" value={formatCurrency(stats.monthRevenue)} icon={PoundSterling} accent="pink" delay="0.12s" />
        <StatCard
          label="Overdue"
          value={String(stats.overdueCount)}
          icon={AlertTriangle}
          accent={stats.overdueCount > 0 ? "warning" : "default"}
          delay="0.16s"
          sub={stats.overdueCount > 0 ? "need attention" : "all up to date"}
        />
      </div>

      {/* Alerts — upcoming cleans */}
      {stats.soonCustomers.length > 0 && (
        <div className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <SectionHeading>Due This Week</SectionHeading>
          <div className="space-y-1">
            {stats.soonCustomers.map(({ customer, due }) => {
              const daysUntil = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div
                  key={customer.id}
                  className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3 cursor-pointer hover:border-primary/40 transition-colors group"
                  onClick={() => navigate("/customers")}
                >
                  <div className="flex items-center gap-3">
                    <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{customer.name}</p>
                      <p className="text-[11px] text-muted-foreground">{customer.address}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[11px] font-semibold text-primary">
                        {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `In ${daysUntil}d`}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{FREQUENCY_LABELS[customer.frequency]}</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming scheduled jobs */}
        <div className="animate-fade-up" style={{ animationDelay: "0.22s" }}>
          <SectionHeading>Scheduled Jobs</SectionHeading>
          <div className="surface rounded-md overflow-hidden">
            {stats.upcoming.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <Circle className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No upcoming jobs scheduled.</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Add one from the Jobs page.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {stats.upcoming.map((job) => {
                  const customer = customers.find((c) => c.id === job.customerId);
                  return (
                    <div key={job.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div>
                        <p className="text-sm font-medium text-foreground">{customer?.name ?? "Unknown"}</p>
                        <p className="text-[11px] text-muted-foreground">{formatDate(job.date)}</p>
                      </div>
                      <span className="font-mono text-sm font-medium text-foreground">{formatCurrency(job.price)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Overdue cleans */}
        <div className="animate-fade-up" style={{ animationDelay: "0.28s" }}>
          <SectionHeading>Overdue Cleans</SectionHeading>
          <div className="surface rounded-md overflow-hidden">
            {stats.overdueCustomers.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <CheckCircle2 className="h-6 w-6 text-success/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">All customers are up to date.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {stats.overdueCustomers.slice(0, 5).map((c) => {
                  const lastJob = jobs
                    .filter((j) => j.customerId === c.id && j.status === "completed")
                    .sort((a, b) => b.date.localeCompare(a.date))[0];
                  const overdueSince = lastJob
                    ? getNextDueDate(lastJob.date, c.frequency)
                    : null;
                  const daysOverdue = overdueSince
                    ? Math.round((now.getTime() - overdueSince.getTime()) / (1000 * 60 * 60 * 24))
                    : null;
                  return (
                    <div
                      key={c.id}
                      className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-destructive/5 transition-colors group"
                      onClick={() => navigate("/customers")}
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{c.name}</p>
                        <p className="text-[11px] text-muted-foreground">{c.address}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-[11px] font-semibold text-destructive">
                            {daysOverdue !== null ? `${daysOverdue}d overdue` : "Overdue"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{FREQUENCY_LABELS[c.frequency]}</p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Revenue summary */}
      <div className="animate-fade-up" style={{ animationDelay: "0.32s" }}>
        <SectionHeading>Revenue Summary</SectionHeading>
        <div className="surface rounded-md p-5 flex flex-wrap gap-8">
          <div>
            <p className="label-caps mb-1">Total Earned</p>
            <p className="font-mono text-xl font-medium text-foreground">{formatCurrency(stats.totalRevenue)}</p>
          </div>
          <div>
            <p className="label-caps mb-1">Outstanding</p>
            <p className={cn("font-mono text-xl font-medium", stats.totalOwed > 0 ? "text-warning" : "text-success")}>
              {formatCurrency(stats.totalOwed)}
            </p>
          </div>
          <div>
            <p className="label-caps mb-1">This Month</p>
            <p className="font-mono text-xl font-medium text-primary">{formatCurrency(stats.monthRevenue)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
