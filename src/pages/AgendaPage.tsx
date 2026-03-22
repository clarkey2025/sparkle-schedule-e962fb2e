import { useMemo } from "react";
import { useApp } from "@/lib/AppContext";
import { formatCurrency } from "@/lib/helpers";
import PageHeader from "@/components/PageHeader";
import { CalendarCheck, Clock, MapPin, PoundSterling, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AgendaPage() {
  const { customers, jobs } = useApp();
  const todayStr = new Date().toISOString().slice(0, 10);

  const todayJobs = useMemo(() => {
    return jobs
      .filter((j) => j.date === todayStr && j.status !== "cancelled")
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((j) => ({ job: j, customer: customers.find((c) => c.id === j.customerId) }));
  }, [jobs, customers, todayStr]);

  const totalValue = todayJobs.reduce((s, { job }) => s + job.price, 0);
  const completedCount = todayJobs.filter(({ job }) => job.status === "completed").length;

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="pb-24 md:pb-0">
      <PageHeader title="Today's Agenda" description={today} />

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3 mb-6 animate-fade-up stagger-1">
        {[
          { label: "Jobs Today", value: String(todayJobs.length), icon: CalendarCheck, colour: "text-foreground" },
          { label: "Completed", value: String(completedCount), icon: CheckCircle2, colour: "text-success" },
          { label: "Day's Value", value: formatCurrency(totalValue), icon: PoundSterling, colour: "text-primary" },
        ].map(({ label, value, icon: Icon, colour }) => (
          <div key={label} className="bg-card border border-border rounded-md p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="label-caps mb-2">{label}</p>
                <p className={cn("font-mono text-[22px] font-medium leading-none", colour)}>{value}</p>
              </div>
              <Icon className="h-4 w-4 text-muted-foreground/30 mt-0.5" />
            </div>
          </div>
        ))}
      </div>

      {/* Map placeholder */}
      <div className="bg-card border border-border rounded-md overflow-hidden mb-6 animate-fade-up stagger-2">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          <span className="text-[13px] font-semibold text-foreground">Route Map</span>
          <span className="ml-auto label-caps text-muted-foreground/50">Coming soon</span>
        </div>
        <div className="flex flex-col items-center justify-center h-48 gap-3 bg-muted/20">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <MapPin className="h-5 w-5 text-muted-foreground/40" />
          </div>
          <div className="text-center">
            <p className="text-[13px] font-medium text-muted-foreground">Interactive map coming soon</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">Will show your route with stop-by-stop navigation</p>
          </div>
        </div>
      </div>

      {/* Job list */}
      <div className="animate-fade-up stagger-3">
        <p className="label-caps mb-3">Jobs</p>
        <div className="bg-card border border-border rounded-md overflow-hidden">
          {todayJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <Circle className="h-8 w-8 text-muted-foreground/20" />
              <div className="text-center">
                <p className="text-[13px] text-muted-foreground font-medium">Nothing scheduled for today</p>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">Head to Jobs to schedule some cleans.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {todayJobs.map(({ job, customer }, i) => (
                <div key={job.id} className={cn(
                  "flex items-center gap-4 px-4 py-3.5 transition-colors",
                  job.status === "completed" ? "opacity-50" : "hover:bg-muted/20"
                )}>
                  <span className="font-mono text-[11px] text-muted-foreground w-5 shrink-0">{i + 1}</span>
                  <div className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                    job.status === "completed"
                      ? "border-success bg-success/10"
                      : "border-border"
                  )}>
                    {job.status === "completed" && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-[13px] font-medium",
                      job.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"
                    )}>
                      {customer?.name ?? "Unknown"}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{customer?.address}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-[13px] font-medium text-foreground">{formatCurrency(job.price)}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{job.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
