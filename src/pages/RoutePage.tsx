import { useMemo } from "react";
import { useApp } from "@/lib/AppContext";
import { formatCurrency } from "@/lib/helpers";
import PageHeader from "@/components/PageHeader";
import { Route, MapPin, Navigation, Clock, PoundSterling } from "lucide-react";

export default function RoutePage() {
  const { customers, jobs } = useApp();

  const scheduledJobs = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return jobs
      .filter((j) => j.status === "scheduled" && j.date >= todayStr)
      .slice(0, 10)
      .map((j) => ({ job: j, customer: customers.find((c) => c.id === j.customerId) }));
  }, [jobs, customers]);

  return (
    <div className="pb-20 md:pb-0 space-y-5">
      <PageHeader title="Route Planner" description="Optimise your daily cleaning round" />

      {/* Feature teaser cards */}
      <div className="grid grid-cols-3 gap-3 animate-fade-up stagger-1">
        {[
          { label: "Stops", value: String(scheduledJobs.length), icon: MapPin },
          { label: "Est. Drive", value: "—", icon: Clock },
          { label: "Round Value", value: formatCurrency(scheduledJobs.reduce((s, { job }) => s + job.price, 0)), icon: PoundSterling },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-card border border-border rounded-md p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="label-caps mb-2">{label}</p>
                <p className="font-mono text-2xl font-medium leading-none text-foreground">{value}</p>
              </div>
              <Icon className="h-4 w-4 text-muted-foreground/30 mt-0.5" />
            </div>
          </div>
        ))}
      </div>

      {/* Map placeholder */}
      <div className="bg-card border border-border rounded-md overflow-hidden animate-fade-up stagger-2">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Navigation className="h-3.5 w-3.5 text-primary" />
          <span className="text-[13px] font-medium text-foreground">Route Map</span>
          <span className="ml-auto label-caps text-muted-foreground/50">Coming soon</span>
        </div>
        <div className="relative flex flex-col items-center justify-center h-64 bg-muted/20 overflow-hidden">
          {/* Decorative grid */}
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: "linear-gradient(hsl(0,0%,60%) 1px, transparent 1px), linear-gradient(90deg, hsl(0,0%,60%) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
          {/* Fake route dots */}
          {[
            { top: "30%", left: "25%" },
            { top: "45%", left: "45%" },
            { top: "55%", left: "60%" },
            { top: "35%", left: "70%" },
          ].map((pos, i) => (
            <div key={i} className="absolute flex items-center justify-center"
              style={{ top: pos.top, left: pos.left }}>
              <div className="h-3 w-3 rounded-full bg-primary/40 ring-4 ring-primary/10" />
              <span className="absolute text-[9px] font-mono font-medium text-primary">{i + 1}</span>
            </div>
          ))}
          <div className="relative flex flex-col items-center gap-2 text-center z-10">
            <Route className="h-6 w-6 text-muted-foreground/30" />
            <p className="text-[13px] font-medium text-muted-foreground">Turn-by-turn route optimisation</p>
            <p className="text-[11px] text-muted-foreground/50">Full map & navigation coming in a future update</p>
          </div>
        </div>
      </div>

      {/* Stop list */}
      <div className="animate-fade-up stagger-3">
        <p className="label-caps mb-3">Upcoming Stops</p>
        <div className="bg-card border border-border rounded-md overflow-hidden">
          {scheduledJobs.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[13px] text-muted-foreground">No scheduled jobs to route.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {scheduledJobs.map(({ job, customer }, i) => (
                <div key={job.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/20 transition-colors">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
                    <span className="font-mono text-[10px] font-medium text-primary">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground">{customer?.name ?? "Unknown"}</p>
                    <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {customer?.address ?? "—"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-[12px] text-foreground">{formatCurrency(job.price)}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(job.date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
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
