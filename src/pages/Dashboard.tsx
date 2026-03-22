import { useMemo } from "react";
import { useApp } from "@/lib/AppContext";
import { formatCurrency, formatDate, getNextDueDate, FREQUENCY_LABELS } from "@/lib/helpers";
import StatCard from "@/components/StatCard";
import PageHeader from "@/components/PageHeader";
import { Users, CalendarCheck, PoundSterling, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

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

    const upcoming = jobs
      .filter((j) => j.status === "scheduled")
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);

    return { totalRevenue, totalOwed: Math.max(0, totalOwed), overdueCount: overdueCustomers.length, upcoming, overdueCustomers };
  }, [customers, jobs, payments]);

  return (
    <div className="pb-20 md:pb-0">
      <PageHeader title="Dashboard" description="Your business at a glance" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 animate-fade-up stagger-1">
        <StatCard label="Customers" value={String(customers.length)} icon={Users} />
        <StatCard label="Jobs Done" value={String(jobs.filter((j) => j.status === "completed").length)} icon={CalendarCheck} />
        <StatCard label="Revenue" value={formatCurrency(stats.totalRevenue)} icon={PoundSterling} />
        <StatCard label="Overdue" value={String(stats.overdueCount)} icon={AlertTriangle} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Upcoming jobs */}
        <div className="glass-card rounded-xl p-5 animate-fade-up stagger-2">
          <h2 className="mb-4 text-base font-semibold">Upcoming Jobs</h2>
          {stats.upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scheduled jobs. Add one from the Jobs page.</p>
          ) : (
            <ul className="space-y-3">
              {stats.upcoming.map((job) => {
                const customer = customers.find((c) => c.id === job.customerId);
                return (
                  <li key={job.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{customer?.name ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(job.date)}</p>
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(job.price)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Overdue */}
        <div className="glass-card rounded-xl p-5 animate-fade-up stagger-3">
          <h2 className="mb-4 text-base font-semibold">Overdue Cleans</h2>
          {stats.overdueCustomers.length === 0 ? (
            <p className="text-sm text-muted-foreground">All customers are up to date!</p>
          ) : (
            <ul className="space-y-3">
              {stats.overdueCustomers.slice(0, 5).map((c) => (
                <li
                  key={c.id}
                  className="flex cursor-pointer items-center justify-between rounded-lg bg-destructive/5 px-4 py-3 transition-colors hover:bg-destructive/10"
                  onClick={() => navigate("/customers")}
                >
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.address}</p>
                  </div>
                  <Badge variant="destructive" className="text-xs">{FREQUENCY_LABELS[c.frequency]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
