import { useMemo, useEffect, useState } from "react";
import { useApp } from "@/lib/AppContext";
import { formatCurrency, getNextDueDate, FREQUENCY_LABELS } from "@/lib/helpers";
import {
  Users,
  PoundSterling,
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  ArrowRight,
  Cloud,
  Sun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Wind,
  Droplets,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

// ─── Weather helpers ────────────────────────────────────────────────────────

type WeatherDay = {
  date: string;
  code: number;
  max: number;
  min: number;
};

function wmoLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly Cloudy";
  if (code === 3) return "Overcast";
  if (code <= 49) return "Foggy";
  if (code <= 59) return "Drizzle";
  if (code <= 69) return "Rain";
  if (code <= 79) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 84) return "Snow Showers";
  if (code <= 99) return "Thunderstorm";
  return "Unknown";
}

function WeatherIcon({ code, className }: { code: number; className?: string }) {
  if (code === 0 || code === 1) return <Sun className={className} />;
  if (code <= 49) return <Cloud className={className} />;
  if (code <= 69 || code === 80 || code === 81 || code === 82) return <CloudRain className={className} />;
  if (code <= 79 || code === 83 || code === 84 || code === 85 || code === 86) return <CloudSnow className={className} />;
  if (code >= 95) return <CloudLightning className={className} />;
  return <Wind className={className} />;
}

function isGoodForCleaning(code: number): boolean {
  return code <= 2; // clear or partly cloudy only
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  variant = "default",
  delay,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  variant?: "default" | "pink" | "success" | "warning";
  delay?: string;
}) {
  const styles: Record<string, string> = {
    default: "text-muted-foreground bg-muted/60",
    pink: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
  };
  return (
    <div className="surface rounded-md p-5 animate-fade-up" style={{ animationDelay: delay }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-caps mb-2">{label}</p>
          <p className="font-mono text-[22px] font-medium tracking-tight text-foreground leading-none">{value}</p>
          {sub && <p className="mt-1.5 text-[11px] text-muted-foreground">{sub}</p>}
        </div>
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded", styles[variant])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const { customers, jobs, payments } = useApp();
  const navigate = useNavigate();
  const now = new Date();

  // Weather state
  const [weather, setWeather] = useState<WeatherDay[] | null>(null);
  const [weatherError, setWeatherError] = useState(false);

  useEffect(() => {
    async function fetchWeather(lat: number, lon: number) {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7`;
        const res = await fetch(url);
        const data = await res.json();
        const days: WeatherDay[] = data.daily.time.map((t: string, i: number) => ({
          date: t,
          code: data.daily.weathercode[i],
          max: Math.round(data.daily.temperature_2m_max[i]),
          min: Math.round(data.daily.temperature_2m_min[i]),
        }));
        setWeather(days);
      } catch {
        setWeatherError(true);
      }
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => fetchWeather(51.5, -0.12) // fallback: London
      );
    } else {
      fetchWeather(51.5, -0.12);
    }
  }, []);

  const stats = useMemo(() => {
    const overdueCustomers = customers
      .map((c) => {
        const lastJob = jobs
          .filter((j) => j.customerId === c.id && j.status === "completed")
          .sort((a, b) => b.date.localeCompare(a.date))[0];
        const dueDate = getNextDueDate(lastJob?.date, c.frequency);
        const daysOverdue = Math.round((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        return { customer: c, dueDate, daysOverdue, lastClean: lastJob?.date };
      })
      .filter(({ daysOverdue }) => daysOverdue > 0)
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    const todayStr = now.toISOString().slice(0, 10);
    const todayJobs = jobs
      .filter((j) => j.status === "scheduled" && j.date === todayStr)
      .map((j) => ({ job: j, customer: customers.find((c) => c.id === j.customerId) }));

    const upcomingJobs = jobs
      .filter((j) => j.status === "scheduled" && j.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8)
      .map((j) => ({ job: j, customer: customers.find((c) => c.id === j.customerId) }));

    const thisMonthRevenue = payments
      .filter((p) => {
        const d = new Date(p.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, p) => s + p.amount, 0);

    return { overdueCustomers, todayJobs, upcomingJobs, thisMonthRevenue };
  }, [customers, jobs, payments]);

  const todayLabel = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="pb-24 md:pb-0 space-y-6">

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Total Customers"
          value={String(customers.length)}
          icon={Users}
          variant="default"
          delay="0.04s"
          sub={customers.length === 1 ? "1 property" : `${customers.length} properties`}
        />
        <StatCard
          label="Overdue Jobs"
          value={String(stats.overdueCustomers.length)}
          icon={AlertTriangle}
          variant={stats.overdueCustomers.length > 0 ? "warning" : "success"}
          delay="0.08s"
          sub={stats.overdueCustomers.length === 0 ? "All up to date" : "Need attention"}
        />
        <StatCard
          label="Monthly Revenue"
          value={formatCurrency(stats.thisMonthRevenue)}
          icon={PoundSterling}
          variant="pink"
          delay="0.12s"
          sub={now.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        />
      </div>

      {/* ── Scheduled Jobs + Overdue Cleans ── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Scheduled Jobs */}
        <div className="animate-fade-up" style={{ animationDelay: "0.16s" }}>
          <div className="surface rounded-md overflow-hidden">
            {/* Card header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-primary" />
                <span className="text-[13px] font-semibold text-foreground">Scheduled Jobs</span>
              </div>
              <span className="label-caps">{todayLabel}</span>
            </div>

            {/* Today's count banner */}
            <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border-b border-border">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-primary/15">
                <span className="font-mono text-[13px] font-bold text-primary">{stats.todayJobs.length}</span>
              </div>
              <p className="text-[12px] text-muted-foreground">
                {stats.todayJobs.length === 0
                  ? "No cleans scheduled for today"
                  : stats.todayJobs.length === 1
                  ? "clean scheduled for today"
                  : "cleans scheduled for today"}
              </p>
            </div>

            {/* Job list */}
            {stats.upcomingJobs.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">No upcoming jobs.</p>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">Add jobs from the Jobs page.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {stats.upcomingJobs.map(({ job, customer }) => {
                  const isToday = job.date === now.toISOString().slice(0, 10);
                  const jobDate = new Date(job.date);
                  const dayLabel = isToday
                    ? "Today"
                    : jobDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
                  return (
                    <div
                      key={job.id}
                      className={cn(
                        "flex items-center justify-between px-4 py-3 transition-colors",
                        isToday ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-1.5 w-1.5 rounded-full shrink-0",
                          isToday ? "bg-primary" : "bg-muted-foreground/30"
                        )} />
                        <div>
                          <p className="text-[13px] font-medium text-foreground">{customer?.name ?? "Unknown"}</p>
                          <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">{customer?.address}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn("text-[11px] font-semibold", isToday ? "text-primary" : "text-muted-foreground")}>{dayLabel}</p>
                        <p className="font-mono text-[12px] text-foreground">{formatCurrency(job.price)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Overdue Cleans */}
        <div className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <div className="surface rounded-md overflow-hidden">
            {/* Card header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="text-[13px] font-semibold text-foreground">Overdue Cleans</span>
              </div>
              {stats.overdueCustomers.length > 0 && (
                <span className="rounded bg-warning/15 border border-warning/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                  {stats.overdueCustomers.length} overdue
                </span>
              )}
            </div>

            {stats.overdueCustomers.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <CheckCircle2 className="h-6 w-6 text-success/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">All customers up to date.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {stats.overdueCustomers.slice(0, 7).map(({ customer: c, daysOverdue }) => (
                  <div
                    key={c.id}
                    className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-warning/5 transition-colors group"
                    onClick={() => navigate("/customers")}
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">{c.address}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className={cn(
                          "text-[12px] font-semibold font-mono",
                          daysOverdue > 14 ? "text-destructive" : "text-warning"
                        )}>
                          {daysOverdue}d late
                        </p>
                        <p className="text-[10px] text-muted-foreground">{FREQUENCY_LABELS[c.frequency]}</p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Weather ── */}
      <div className="animate-fade-up" style={{ animationDelay: "0.24s" }}>
        <div className="surface rounded-md overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Cloud className="h-4 w-4 text-primary" />
            <span className="text-[13px] font-semibold text-foreground">7-Day Weather</span>
            <span className="label-caps ml-auto">Good days to clean</span>
          </div>

          {weatherError ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">Weather unavailable.</p>
            </div>
          ) : !weather ? (
            <div className="flex gap-0 overflow-x-auto">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex-1 min-w-[80px] flex flex-col items-center gap-2 px-3 py-4 border-r border-border last:border-r-0 animate-pulse">
                  <div className="h-2.5 w-10 rounded bg-muted" />
                  <div className="h-6 w-6 rounded bg-muted" />
                  <div className="h-2.5 w-8 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex overflow-x-auto">
              {weather.map((day, i) => {
                const d = new Date(day.date + "T12:00:00");
                const dayName = i === 0 ? "Today" : d.toLocaleDateString("en-GB", { weekday: "short" });
                const good = isGoodForCleaning(day.code);
                return (
                  <div
                    key={day.date}
                    className={cn(
                      "flex-1 min-w-[80px] flex flex-col items-center gap-1.5 px-2 py-4 border-r border-border last:border-r-0 transition-colors",
                      good ? "bg-primary/5" : ""
                    )}
                  >
                    <p className={cn("text-[10px] font-semibold tracking-wide uppercase", i === 0 ? "text-primary" : "text-muted-foreground")}>
                      {dayName}
                    </p>
                    <WeatherIcon
                      code={day.code}
                      className={cn("h-5 w-5", good ? "text-primary" : "text-muted-foreground/60")}
                    />
                    <p className="text-[11px] text-muted-foreground text-center leading-tight">{wmoLabel(day.code)}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="font-mono text-[11px] font-medium text-foreground">{day.max}°</span>
                      <span className="font-mono text-[10px] text-muted-foreground/50">{day.min}°</span>
                    </div>
                    {good && (
                      <span className="rounded bg-primary/15 border border-primary/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
                        Clean
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
