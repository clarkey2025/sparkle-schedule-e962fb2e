import { useMemo, useEffect, useState, useCallback } from "react";
import { useApp } from "@/lib/AppContext";
import { formatCurrency, getNextDueDate, FREQUENCY_LABELS } from "@/lib/helpers";
import {
  Users, PoundSterling, AlertTriangle, CalendarCheck, CheckCircle2,
  Cloud, Sun, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, Wind, MapPin,
  MoreHorizontal, Check, BellOff, CalendarX,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

// ─── Snooze store (localStorage) ────────────────────────────────────────────
const SNOOZE_KEY = "pane-pro-snoozes";
function loadSnoozes(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(SNOOZE_KEY) ?? "{}"); } catch { return {}; }
}
function saveSnoozes(s: Record<string, string>) {
  localStorage.setItem(SNOOZE_KEY, JSON.stringify(s));
}

// ─── Weather helpers ────────────────────────────────────────────────────────
type WeatherDay = { date: string; code: number; max: number; min: number };

function wmoLabel(code: number) {
  if (code === 0) return "Clear skies"; if (code === 1) return "Mostly clear";
  if (code === 2) return "Partly cloudy"; if (code === 3) return "Overcast";
  if (code <= 49) return "Foggy"; if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain"; if (code <= 77) return "Snow";
  if (code <= 82) return "Showers"; if (code <= 86) return "Snow showers";
  if (code <= 99) return "Thunderstorm"; return "—";
}
function wmoShort(code: number) {
  if (code === 0 || code === 1) return "Clear"; if (code === 2) return "Pt. Cloudy";
  if (code === 3) return "Overcast"; if (code <= 49) return "Foggy";
  if (code <= 57) return "Drizzle"; if (code <= 67) return "Rain";
  if (code <= 77) return "Snow"; if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers"; if (code >= 95) return "Storm"; return "—";
}
function WeatherIcon({ code, className }: { code: number; className?: string }) {
  if (code === 0 || code === 1) return <Sun className={className} />;
  if (code === 2 || code === 3) return <Cloud className={className} />;
  if (code <= 57) return <CloudDrizzle className={className} />;
  if (code <= 67 || (code >= 80 && code <= 82)) return <CloudRain className={className} />;
  if (code <= 77 || (code >= 83 && code <= 86)) return <CloudSnow className={className} />;
  if (code >= 95) return <CloudLightning className={className} />;
  return <Wind className={className} />;
}
function isGoodForCleaning(code: number) { return code <= 2; }

// ─── Job schedule grouping ───────────────────────────────────────────────────
function getGroupLabel(date: string, todayStr: string): string {
  const diff = Math.round(
    (new Date(date + "T12:00:00").getTime() - new Date(todayStr + "T12:00:00").getTime())
    / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return "today";
  if (diff <= 6) return "this-week";
  if (diff <= 13) return "next-week";
  const jobDate = new Date(date + "T12:00:00");
  return jobDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

const GROUP_META: Record<string, { label: string; order: number }> = {
  "today": { label: "Today", order: 0 },
  "this-week": { label: "This Week", order: 1 },
  "next-week": { label: "Next Week", order: 2 },
};

// ─── Dashboard ───────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { customers, jobs, payments, addJob } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const [snoozes, setSnoozes] = useState<Record<string, string>>(loadSnoozes);
  const [weather, setWeather] = useState<WeatherDay[] | null>(null);
  const [locationName, setLocationName] = useState("");
  const [weatherError, setWeatherError] = useState(false);

  useEffect(() => {
    async function fetchWeather(lat: number, lon: number) {
      try {
        const [wr, gr] = await Promise.all([
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7`),
          fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`),
        ]);
        const wd = await wr.json();
        const gd = await gr.json();
        setLocationName(gd?.address?.town || gd?.address?.city || gd?.address?.village || "");
        setWeather(wd.daily.time.map((t: string, i: number) => ({
          date: t, code: wd.daily.weathercode[i],
          max: Math.round(wd.daily.temperature_2m_max[i]),
          min: Math.round(wd.daily.temperature_2m_min[i]),
        })));
      } catch { setWeatherError(true); }
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => fetchWeather(p.coords.latitude, p.coords.longitude),
        () => fetchWeather(51.5, -0.12)
      );
    } else fetchWeather(51.5, -0.12);
  }, []);

  const snooze = useCallback((customerId: string, days: number) => {
    const until = new Date();
    until.setDate(until.getDate() + days);
    const next = { ...snoozes, [customerId]: until.toISOString() };
    setSnoozes(next);
    saveSnoozes(next);
    const c = customers.find((x) => x.id === customerId);
    toast({ title: `Snoozed ${c?.name}`, description: `Removed from overdue list for ${days} days.` });
  }, [snoozes, customers, toast]);

  const markDone = useCallback((customerId: string) => {
    const c = customers.find((x) => x.id === customerId);
    if (!c) return;
    addJob({ customerId, date: todayStr, status: "completed", price: c.pricePerClean, notes: "Marked done from dashboard" });
    // Clear any snooze
    const next = { ...snoozes };
    delete next[customerId];
    setSnoozes(next);
    saveSnoozes(next);
    toast({ title: `Marked done — ${c.name}`, description: `£${c.pricePerClean.toFixed(2)} job logged for today.` });
  }, [customers, addJob, todayStr, snoozes, toast]);

  const stats = useMemo(() => {
    const activeSnoozes = Object.entries(snoozes)
      .filter(([, until]) => new Date(until) > now)
      .map(([id]) => id);

    const overdueCustomers = customers
      .filter((c) => !activeSnoozes.includes(c.id))
      .map((c) => {
        const lastJob = jobs.filter((j) => j.customerId === c.id && j.status === "completed")
          .sort((a, b) => b.date.localeCompare(a.date))[0];
        const dueDate = getNextDueDate(lastJob?.date, c.frequency);
        const daysOverdue = Math.round((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        return { customer: c, daysOverdue };
      })
      .filter(({ daysOverdue }) => daysOverdue > 0)
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    // Scheduled jobs grouped by time period
    const upcomingRaw = jobs
      .filter((j) => j.status === "scheduled" && j.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((j) => ({ job: j, customer: customers.find((c) => c.id === j.customerId), group: getGroupLabel(j.date, todayStr) }));

    // Build ordered groups
    const groupMap = new Map<string, typeof upcomingRaw>();
    for (const item of upcomingRaw) {
      if (!groupMap.has(item.group)) groupMap.set(item.group, []);
      groupMap.get(item.group)!.push(item);
    }
    // Sort groups: today, this-week, next-week, then monthly labels chronologically
    const orderedGroups = [...groupMap.entries()].sort(([a], [b]) => {
      const oa = GROUP_META[a]?.order ?? 10 + new Date(groupMap.get(a)![0].job.date).getTime();
      const ob = GROUP_META[b]?.order ?? 10 + new Date(groupMap.get(b)![0].job.date).getTime();
      return oa - ob;
    });

    const thisMonthRevenue = payments
      .filter((p) => { const d = new Date(p.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
      .reduce((s, p) => s + p.amount, 0);

    const snoozedCount = activeSnoozes.length;

    return { overdueCustomers, orderedGroups, thisMonthRevenue, snoozedCount };
  }, [customers, jobs, payments, snoozes]);

  const today = weather?.[0];
  const goodDays = weather?.filter((d) => isGoodForCleaning(d.code)).length ?? 0;

  return (
    <div className="pb-24 md:pb-0 space-y-4">

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Total Customers", value: String(customers.length),
            sub: `${customers.length} properties on round`,
            colour: "text-foreground", icon: Users,
          },
          {
            label: "Overdue Cleans", value: String(stats.overdueCustomers.length),
            sub: stats.overdueCustomers.length === 0 ? "All up to date"
              : stats.snoozedCount > 0 ? `${stats.snoozedCount} snoozed` : "Needs attention",
            colour: stats.overdueCustomers.length > 0 ? "text-warning" : "text-success",
            icon: AlertTriangle,
          },
          {
            label: "Monthly Revenue", value: formatCurrency(stats.thisMonthRevenue),
            sub: now.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
            colour: "text-primary", icon: PoundSterling,
          },
        ].map(({ label, value, sub, colour, icon: Icon }, i) => (
          <div key={label} className="bg-card border border-border rounded-md p-4 animate-fade-up"
            style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="label-caps mb-3">{label}</p>
                <p className={cn("font-mono text-[26px] font-medium leading-none tracking-tight", colour)}>{value}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">{sub}</p>
              </div>
              <Icon className="h-4 w-4 text-muted-foreground/25 shrink-0 mt-0.5" />
            </div>
          </div>
        ))}
      </div>

      {/* ── Scheduled + Overdue ── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Scheduled Jobs — grouped */}
        <div className="animate-fade-up bg-card rounded-md overflow-hidden border border-border flex flex-col"
          style={{ animationDelay: "0.15s" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-3.5 w-3.5 text-primary" />
              <span className="text-[13px] font-semibold text-foreground">Scheduled Jobs</span>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
              {jobs.filter((j) => j.status === "scheduled" && j.date >= todayStr).length} upcoming
            </span>
          </div>

          <div className="overflow-y-auto max-h-72">
            {stats.orderedGroups.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-[13px] text-muted-foreground">No upcoming jobs.</p>
              </div>
            ) : (
              stats.orderedGroups.map(([groupKey, items]) => {
                const groupLabel = GROUP_META[groupKey]?.label ?? groupKey;
                const groupTotal = items.reduce((s, { job }) => s + job.price, 0);
                return (
                  <div key={groupKey}>
                    {/* Group header */}
                    <div className="flex items-center justify-between px-4 py-1.5 bg-muted/40 sticky top-0">
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-widest",
                        groupKey === "today" ? "text-primary" : "text-muted-foreground"
                      )}>{groupLabel}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {items.length} job{items.length !== 1 ? "s" : ""} · {formatCurrency(groupTotal)}
                      </span>
                    </div>
                    {/* Jobs */}
                    {items.map(({ job, customer }) => {
                      const isToday = job.date === todayStr;
                      const d = new Date(job.date + "T12:00:00");
                      const dayLabel = isToday ? "Today"
                        : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
                      return (
                        <div key={job.id} className={cn(
                          "flex items-center justify-between px-4 py-2.5 border-b border-border/50 last:border-b-0 transition-colors",
                          isToday ? "bg-primary/[0.03]" : "hover:bg-muted/20"
                        )}>
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0",
                              isToday ? "bg-primary" : "bg-border")} />
                            <div className="min-w-0">
                              <p className="text-[12px] font-medium text-foreground truncate">{customer?.name ?? "Unknown"}</p>
                              <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">{customer?.address}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <p className={cn("text-[11px] font-semibold", isToday ? "text-primary" : "text-muted-foreground")}>{dayLabel}</p>
                            <p className="font-mono text-[11px] text-foreground">{formatCurrency(job.price)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Overdue Cleans — with 3-dot menu */}
        <div className="animate-fade-up bg-card rounded-md overflow-hidden border border-border flex flex-col"
          style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              <span className="text-[13px] font-semibold text-foreground">Overdue Cleans</span>
            </div>
            {stats.overdueCustomers.length > 0 ? (
              <span className="rounded bg-warning/15 border border-warning/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                {stats.overdueCustomers.length} overdue
              </span>
            ) : (
              <CheckCircle2 className="h-4 w-4 text-success/50" />
            )}
          </div>

          <div className="overflow-y-auto max-h-72">
            {stats.overdueCustomers.length === 0 ? (
              <div className="py-10 text-center flex flex-col items-center gap-2">
                <CheckCircle2 className="h-7 w-7 text-success/30" />
                <p className="text-[13px] text-muted-foreground">All cleans are on schedule.</p>
                {stats.snoozedCount > 0 && (
                  <p className="text-[11px] text-muted-foreground/50">{stats.snoozedCount} snoozed</p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {stats.overdueCustomers.map(({ customer: c, daysOverdue }) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group">
                    {/* Severity indicator */}
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0",
                      daysOverdue > 30 ? "bg-destructive" : daysOverdue > 14 ? "bg-warning" : "bg-warning/60")} />
                    {/* Customer info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{c.address}</p>
                    </div>
                    {/* Badge + menu */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn(
                        "font-mono text-[11px] font-semibold rounded px-1.5 py-0.5",
                        daysOverdue > 30
                          ? "bg-destructive/15 text-destructive"
                          : "bg-warning/15 text-warning"
                      )}>
                        {daysOverdue}d
                      </span>
                      <span className="text-[10px] text-muted-foreground hidden sm:block">
                        {FREQUENCY_LABELS[c.frequency]}
                      </span>
                      {/* 3-dot menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-muted text-muted-foreground/40 hover:text-foreground">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-card border border-border shadow-lg shadow-black/40">
                          <DropdownMenuItem
                            className="flex items-center gap-2 text-[12px] cursor-pointer"
                            onClick={() => markDone(c.id)}
                          >
                            <Check className="h-3.5 w-3.5 text-success" />
                            Mark as done today
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-border" />
                          <DropdownMenuItem
                            className="flex items-center gap-2 text-[12px] cursor-pointer"
                            onClick={() => snooze(c.id, 7)}
                          >
                            <BellOff className="h-3.5 w-3.5 text-muted-foreground" />
                            Snooze 1 week
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="flex items-center gap-2 text-[12px] cursor-pointer"
                            onClick={() => snooze(c.id, 30)}
                          >
                            <CalendarX className="h-3.5 w-3.5 text-muted-foreground" />
                            Snooze 1 month
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Weather ── */}
      <div className="animate-fade-up bg-card rounded-md overflow-hidden border border-border"
        style={{ animationDelay: "0.25s" }}>
        {!weatherError && (
          <div className="flex items-stretch border-b border-border">
            <div className="flex-1 px-5 py-4 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 mb-3">
                {locationName
                  ? <><MapPin className="h-3 w-3 text-muted-foreground/40" /><span className="text-[11px] text-muted-foreground">{locationName}</span></>
                  : <span className="label-caps">Today's forecast</span>}
              </div>
              {!today ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-9 w-20 rounded bg-muted" />
                  <div className="h-3 w-28 rounded bg-muted" />
                </div>
              ) : (
                <>
                  <div className="flex items-end gap-3">
                    <WeatherIcon code={today.code} className="h-8 w-8 text-primary shrink-0" />
                    <div>
                      <p className="font-mono text-[32px] font-medium leading-none text-foreground">
                        {today.max}°<span className="text-[16px] text-muted-foreground font-normal">C</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">{wmoLabel(today.code)} · low {today.min}°</p>
                    </div>
                  </div>
                  <p className={cn("text-[12px] font-medium mt-2",
                    isGoodForCleaning(today.code) ? "text-primary" : "text-muted-foreground")}>
                    {isGoodForCleaning(today.code) ? "✓ Good day to clean" : "✗ Not ideal for cleaning"}
                  </p>
                </>
              )}
            </div>
            {weather && (
              <div className="flex flex-col items-center justify-center px-5 border-l border-border gap-0.5 bg-muted/20 min-w-[90px]">
                <p className="font-mono text-[28px] font-medium leading-none text-primary">{goodDays}</p>
                <p className="text-[10px] text-muted-foreground text-center leading-tight">good days<br />this week</p>
              </div>
            )}
          </div>
        )}

        {weatherError ? (
          <div className="px-4 py-5 text-center"><p className="text-[13px] text-muted-foreground">Weather unavailable.</p></div>
        ) : !weather ? (
          <div className="flex">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 px-2 py-3 border-r border-border last:border-r-0 animate-pulse">
                <div className="h-2 w-7 rounded bg-muted" /><div className="h-4 w-4 rounded bg-muted" /><div className="h-2 w-6 rounded bg-muted" />
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
                <div key={day.date} className={cn(
                  "flex-1 min-w-[64px] flex flex-col items-center gap-1 px-1 py-2.5 border-r border-border last:border-r-0",
                  good && i !== 0 ? "bg-primary/[0.04]" : "",
                  i === 0 ? "bg-muted/30" : ""
                )}>
                  <p className={cn("text-[10px] font-bold uppercase tracking-wide", i === 0 ? "text-primary" : "text-muted-foreground/50")}>{dayName}</p>
                  <WeatherIcon code={day.code} className={cn("h-4 w-4 my-0.5", good ? "text-primary" : "text-muted-foreground/35")} />
                  <p className="text-[10px] text-muted-foreground/60 text-center leading-tight px-0.5">{wmoShort(day.code)}</p>
                  <p className="font-mono text-[11px] text-foreground/60">{day.max}°</p>
                  {good && i !== 0 && <div className="h-1 w-1 rounded-full bg-primary mt-0.5" />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
