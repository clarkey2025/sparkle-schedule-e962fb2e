import { useMemo, useEffect, useState, useCallback } from "react";
import { useApp } from "@/lib/AppContext";
import { formatCurrency, formatDate, getNextDueDate, FREQUENCY_LABELS } from "@/lib/helpers";
import {
  Users, PoundSterling, AlertTriangle, CalendarCheck, CheckCircle2,
  Cloud, Sun, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, Wind, MapPin,
  MoreHorizontal, Check, BellOff, CalendarX, ChevronDown, ChevronRight,
  TrendingUp, Banknote, FlaskConical, Droplets, Pencil, X as XIcon,
  FileText, Clock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// ─── Snooze store ─────────────────────────────────────────────────────────
const SNOOZE_KEY = "pane-pro-snoozes";
function loadSnoozes(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(SNOOZE_KEY) ?? "{}"); } catch { return {}; }
}
function saveSnoozes(s: Record<string, string>) { localStorage.setItem(SNOOZE_KEY, JSON.stringify(s)); }

// ─── Weather helpers ──────────────────────────────────────────────────────
type WeatherDay = { date: string; code: number; max: number; min: number; rainChance: number; windMax: number };
function wmoShort(code: number) {
  if (code === 0 || code === 1) return "Clear";
  if (code === 2) return "Pt. Cloudy";
  if (code === 3) return "Overcast";
  if (code <= 49) return "Foggy";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  if (code >= 95) return "Storm";
  return "—";
}
function wmoVerdict(code: number, rainChance?: number, windMax?: number): { label: string; good: boolean } {
  if (windMax && windMax > 50) return { label: "Too windy", good: false };
  if (rainChance && rainChance > 70) return { label: "Rain likely — avoid", good: false };
  if (code <= 1) return { label: "Perfect day to clean", good: true };
  if (code === 2) return { label: "Should be fine", good: true };
  if (code === 3) return { label: "Manageable", good: rainChance ? rainChance < 40 : false };
  if (code <= 57) return { label: "Drizzle — risky", good: false };
  if (code <= 82) return { label: "Rain — avoid", good: false };
  return { label: "Don't bother", good: false };
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

// ─── Schedule grouping ────────────────────────────────────────────────────
function getDayDiff(date: string, todayStr: string) {
  return Math.round(
    (new Date(date + "T12:00:00").getTime() - new Date(todayStr + "T12:00:00").getTime())
    / (1000 * 60 * 60 * 24)
  );
}
function getGroupKey(diff: number, date: string): string {
  if (diff === 0) return "today";
  if (diff <= 6) return "this-week";
  const d = new Date(date + "T12:00:00");
  return `month-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function getGroupLabel(key: string): string {
  if (key === "today") return "Today";
  if (key === "this-week") return "This Week";
  const [, year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

// ─── Custom tooltip for chart ──────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md bg-card border border-border px-3 py-2 shadow-lg">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-[13px] font-semibold text-primary font-mono">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { customers, jobs, payments, quotes, addJob, isDemoActive, loadMockData, clearMockData } = useApp();
  const { toast } = useToast();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const [snoozes, setSnoozes] = useState<Record<string, string>>(loadSnoozes);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [weather, setWeather] = useState<WeatherDay[] | null>(null);
  const [locationName, setLocationName] = useState("");
  const [weatherError, setWeatherError] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [locationInput, setLocationInput] = useState("");

  const LOCATION_KEY = "pane-pro-weather-location";

  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    try {
      const [wr, gr] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=auto&forecast_days=7`),
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`),
      ]);
      const wd = await wr.json();
      const gd = await gr.json();
      const name = gd?.address?.town || gd?.address?.city || gd?.address?.village || gd?.address?.suburb || "";
      setLocationName(name);
      setWeather(wd.daily.time.map((t: string, i: number) => ({
        date: t, code: wd.daily.weathercode[i],
        max: Math.round(wd.daily.temperature_2m_max[i]),
        min: Math.round(wd.daily.temperature_2m_min[i]),
        rainChance: wd.daily.precipitation_probability_max?.[i] ?? 0,
        windMax: Math.round(wd.daily.wind_speed_10m_max?.[i] ?? 0),
      })));
      setWeatherError(false);
    } catch { setWeatherError(true); }
  }, []);

  const geocodeAndFetch = useCallback(async (query: string) => {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=gb`);
      const results = await r.json();
      if (results.length > 0) {
        const { lat, lon } = results[0];
        localStorage.setItem(LOCATION_KEY, query);
        await fetchWeather(parseFloat(lat), parseFloat(lon));
      } else {
        toast({ title: "Location not found", description: "Try a different town or postcode.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Geocoding failed", description: "Couldn't look up that location.", variant: "destructive" });
    }
  }, [fetchWeather, toast]);

  useEffect(() => {
    const savedLocation = localStorage.getItem(LOCATION_KEY);
    if (savedLocation) {
      geocodeAndFetch(savedLocation);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => fetchWeather(p.coords.latitude, p.coords.longitude),
        () => fetchWeather(51.5, -0.12)
      );
    } else {
      fetchWeather(51.5, -0.12);
    }
  }, []);

  const handleLocationSubmit = () => {
    const q = locationInput.trim();
    if (!q) return;
    geocodeAndFetch(q);
    setEditingLocation(false);
    setLocationInput("");
  };

  const clearSavedLocation = () => {
    localStorage.removeItem(LOCATION_KEY);
    setEditingLocation(false);
    setLocationInput("");
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => fetchWeather(p.coords.latitude, p.coords.longitude),
        () => fetchWeather(51.5, -0.12)
      );
    } else fetchWeather(51.5, -0.12);
  };

  const snooze = useCallback((customerId: string, days: number) => {
    const until = new Date(); until.setDate(until.getDate() + days);
    const next = { ...snoozes, [customerId]: until.toISOString() };
    setSnoozes(next); saveSnoozes(next);
    const c = customers.find((x) => x.id === customerId);
    toast({ title: `Snoozed ${c?.name}`, description: `Hidden for ${days} days.` });
  }, [snoozes, customers, toast]);

  const markDone = useCallback((customerId: string) => {
    const c = customers.find((x) => x.id === customerId);
    if (!c) return;
    addJob({ customerId, date: todayStr, status: "completed", price: c.pricePerClean, notes: "Marked done from dashboard" });
    const next = { ...snoozes }; delete next[customerId];
    setSnoozes(next); saveSnoozes(next);
    toast({ title: `Done — ${c.name}`, description: `£${c.pricePerClean.toFixed(2)} logged for today.` });
  }, [customers, addJob, todayStr, snoozes, toast]);

  const stats = useMemo(() => {
    const activeSnoozes = Object.entries(snoozes)
      .filter(([, until]) => new Date(until) > now).map(([id]) => id);

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

    const upcomingRaw = jobs
      .filter((j) => {
        if (j.status !== "scheduled") return false;
        const diff = getDayDiff(j.date, todayStr);
        return diff >= 0;
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((j) => {
        const diff = getDayDiff(j.date, todayStr);
        return { job: j, customer: customers.find((c) => c.id === j.customerId), group: getGroupKey(diff, j.date), diff };
      });

    const groupMap = new Map<string, typeof upcomingRaw>();
    for (const item of upcomingRaw) {
      if (!groupMap.has(item.group)) groupMap.set(item.group, []);
      groupMap.get(item.group)!.push(item);
    }
    const orderedGroups = [...groupMap.entries()]
      .filter(([k]) => k !== "__beyond__")
      .sort(([a], [b]) => (a === "today" ? -1 : b === "today" ? 1 : 0));

    const thisMonthRevenue = payments
      .filter((p) => { const d = new Date(p.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
      .reduce((s, p) => s + p.amount, 0);

    // Monthly earnings data (last 6 months)
    const monthlyEarnings: { month: string; revenue: number; jobs: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleDateString("en-GB", { month: "short", year: i > 0 && d.getFullYear() !== now.getFullYear() ? "2-digit" : undefined });
      const monthPayments = payments.filter((p) => {
        const pd = new Date(p.date);
        return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear();
      });
      const monthJobs = jobs.filter((j) => {
        const jd = new Date(j.date);
        return j.status === "completed" && jd.getMonth() === d.getMonth() && jd.getFullYear() === d.getFullYear();
      });
      monthlyEarnings.push({ month: monthLabel, revenue: monthPayments.reduce((s, p) => s + p.amount, 0), jobs: monthJobs.length });
    }

    // Outstanding balances per customer
    const outstandingCustomers = customers.map((c) => {
      const totalBilled = jobs
        .filter((j) => j.customerId === c.id && j.status === "completed")
        .reduce((s, j) => s + j.price, 0) + (c.importedBalance ?? 0);
      const totalPaid = payments
        .filter((p) => p.customerId === c.id)
        .reduce((s, p) => s + p.amount, 0);
      const outstanding = totalBilled - totalPaid;
      return { customer: c, outstanding };
    }).filter(({ outstanding }) => outstanding > 0.01)
      .sort((a, b) => b.outstanding - a.outstanding);

    const totalOutstanding = outstandingCustomers.reduce((s, { outstanding }) => s + outstanding, 0);

    return { overdueCustomers, orderedGroups, thisMonthRevenue, snoozedCount: activeSnoozes.length, monthlyEarnings, outstandingCustomers, totalOutstanding };
  }, [customers, jobs, payments, snoozes]);

  const today = weather?.[0];
  const verdict = today ? wmoVerdict(today.code, today.rainChance, today.windMax) : null;

  return (
    <div className="pb-24 md:pb-0 space-y-4">

      {/* ── Demo data banner ── */}
      <div className={`flex items-center gap-3 rounded-md border px-4 py-3 text-[12px] transition-all ${
        isDemoActive
          ? "bg-primary/10 border-primary/30 text-foreground"
          : "bg-muted/30 border-border text-muted-foreground"
      }`}>
        <FlaskConical className={`h-4 w-4 shrink-0 ${isDemoActive ? "text-primary" : "text-muted-foreground/50"}`} />
        <div className="flex-1 min-w-0">
          <span className="font-medium">{isDemoActive ? "Demo data active" : "Demo data off"}</span>
          <span className="ml-2 opacity-70">
            {isDemoActive ? "16 sample customers, jobs, payments & rounds loaded." : "Load sample data to explore all features."}
          </span>
        </div>
        <button
          onClick={isDemoActive ? clearMockData : loadMockData}
          className={`shrink-0 rounded px-3 py-1.5 text-[11px] font-semibold transition-all ${
            isDemoActive
              ? "bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25"
              : "bg-primary text-primary-foreground hover:bg-primary/85 shadow-glow-pink"
          }`}
        >
          {isDemoActive ? "Clear demo data" : "Load demo data"}
        </button>
      </div>


      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Customers", value: String(customers.length), sub: "properties on round", colour: "text-foreground", icon: Users },
          { label: "Overdue Cleans", value: String(stats.overdueCustomers.length), sub: stats.overdueCustomers.length === 0 ? "All up to date" : stats.snoozedCount > 0 ? `${stats.snoozedCount} snoozed` : "Needs attention", colour: stats.overdueCustomers.length > 0 ? "text-warning" : "text-success", icon: AlertTriangle },
          { label: "Monthly Revenue", value: formatCurrency(stats.thisMonthRevenue), sub: now.toLocaleDateString("en-GB", { month: "long", year: "numeric" }), colour: "text-primary", icon: PoundSterling },
        ].map(({ label, value, sub, colour, icon: Icon }, i) => (
          <div key={label} className="bg-card border border-border rounded-md p-4 animate-fade-up" style={{ animationDelay: `${i * 0.05}s` }}>
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

      {/* ── Weather ── */}
      <div className="animate-fade-up bg-card rounded-md overflow-hidden border border-border" style={{ animationDelay: "0.15s" }}>
        {weatherError ? (
          <div className="px-4 py-3 text-center"><p className="text-[12px] text-muted-foreground">Weather unavailable.</p></div>
        ) : !weather ? (
          <div className="flex">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 px-2 py-3 border-r border-border last:border-r-0 animate-pulse">
                <div className="h-2 w-7 rounded bg-muted" /><div className="h-4 w-4 rounded bg-muted" /><div className="h-2 w-5 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex overflow-x-auto">
            {weather.map((day, i) => {
              const d = new Date(day.date + "T12:00:00");
              const dayName = i === 0 ? "Today" : d.toLocaleDateString("en-GB", { weekday: "short" });
              const v = wmoVerdict(day.code, day.rainChance, day.windMax);
              const isToday = i === 0;
              return (
                <div key={day.date} className={cn(
                  "flex flex-col items-center gap-1 border-r border-border last:border-r-0 transition-colors",
                  isToday ? "min-w-[140px] px-4 py-3 bg-muted/30" : "flex-1 min-w-[75px] px-2 py-3",
                  v.good && !isToday ? "bg-primary/[0.03]" : ""
                )}>
                  <p className={cn("text-[10px] font-bold uppercase tracking-wide", isToday ? "text-primary" : "text-muted-foreground/50")}>{dayName}</p>
                  <WeatherIcon code={day.code} className={cn("my-0.5", isToday ? "h-5 w-5 text-primary" : cn("h-4 w-4", v.good ? "text-primary/70" : "text-muted-foreground/35"))} />
                  {isToday ? (
                    <>
                      <p className="font-mono text-[18px] font-medium leading-none text-foreground">{day.max}°<span className="text-[12px] text-muted-foreground font-normal">C</span></p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                          <Droplets className="h-2.5 w-2.5" />{day.rainChance}%
                        </span>
                        <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                          <Wind className="h-2.5 w-2.5" />{day.windMax}<span className="text-[8px]">km/h</span>
                        </span>
                      </div>
                      <p className={cn("text-[10px] font-medium mt-0.5", v.good ? "text-primary" : "text-muted-foreground/60")}>
                        {v.good ? "✓" : "✗"} {v.label}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-mono text-[11px] text-foreground/60">{day.max}°</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="flex items-center gap-0.5 text-[8px] text-muted-foreground/50">
                          <Droplets className="h-2 w-2" />{day.rainChance}%
                        </span>
                        <span className="flex items-center gap-0.5 text-[8px] text-muted-foreground/50">
                          <Wind className="h-2 w-2" />{day.windMax}
                        </span>
                      </div>
                      <span className={cn(
                        "mt-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider",
                        v.good ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground/50"
                      )}>
                        {v.good ? "Good" : "Avoid"}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
            {/* Location panel */}
            <div className="flex flex-col items-center justify-center px-3 border-l border-border bg-muted/10 min-w-[80px] gap-1">
              {editingLocation ? (
                <div className="flex flex-col items-center gap-1.5">
                  <Input
                    autoFocus
                    value={locationInput}
                    onChange={(e) => setLocationInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLocationSubmit()}
                    placeholder="Town or postcode"
                    className="h-6 w-20 text-[10px] px-1.5"
                  />
                  <div className="flex gap-1">
                    <button onClick={handleLocationSubmit} className="text-[9px] text-primary font-semibold hover:underline">Set</button>
                    <button onClick={() => setEditingLocation(false)} className="text-[9px] text-muted-foreground hover:underline">Cancel</button>
                  </div>
                  {localStorage.getItem(LOCATION_KEY) && (
                    <button onClick={clearSavedLocation} className="text-[8px] text-destructive hover:underline">Reset to auto</button>
                  )}
                </div>
              ) : (
                <button onClick={() => setEditingLocation(true)} className="group/loc flex flex-col items-center gap-1 cursor-pointer">
                  <MapPin className="h-3 w-3 text-muted-foreground/30 group-hover/loc:text-primary transition-colors" />
                  <p className="text-[9px] text-muted-foreground/40 text-center leading-tight group-hover/loc:text-foreground transition-colors">
                    {locationName || "Set location"}
                  </p>
                  <Pencil className="h-2.5 w-2.5 text-muted-foreground/20 group-hover/loc:text-primary transition-colors" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Monthly Earnings Chart ── */}
      <div className="animate-fade-up bg-card rounded-md overflow-hidden border border-border" style={{ animationDelay: "0.17s" }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            <span className="text-[13px] font-semibold text-foreground">Earnings</span>
          </div>
          <span className="text-[11px] text-muted-foreground">Last 6 months</span>
        </div>
        <div className="px-2 py-3" style={{ height: 180 }}>
          {stats.monthlyEarnings.every((m) => m.revenue === 0) ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-[12px] text-muted-foreground/40">No payment data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.monthlyEarnings} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="primaryGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${v}`} width={45} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#primaryGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Scheduled + Overdue + Outstanding ── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Scheduled Jobs — collapsible groups, 7-day window */}
        <div className="animate-fade-up bg-card rounded-md overflow-hidden border border-border flex flex-col" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-3.5 w-3.5 text-primary" />
              <span className="text-[13px] font-semibold text-foreground">Next 7 Days</span>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
              {stats.orderedGroups.reduce((s, [, items]) => s + items.length, 0)} jobs
            </span>
          </div>

          <div className="overflow-y-auto max-h-72">
            {stats.orderedGroups.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-[13px] text-muted-foreground">No jobs in the next 7 days.</p>
                <p className="text-[11px] text-muted-foreground/40 mt-1">Head to Jobs to schedule some.</p>
              </div>
            ) : (
              stats.orderedGroups.map(([groupKey, items]) => {
                const isCollapsed = collapsed.has(groupKey);
                const groupTotal = items.reduce((s, { job }) => s + job.price, 0);
                return (
                  <div key={groupKey}>
                    <button
                      onClick={() => toggleGroup(groupKey)}
                      className="w-full flex items-center justify-between px-4 py-2 bg-muted/40 hover:bg-muted/60 transition-colors sticky top-0 z-10"
                    >
                      <div className="flex items-center gap-2">
                        {isCollapsed
                          ? <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                          : <ChevronDown className="h-3 w-3 text-muted-foreground/50" />}
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-widest",
                          groupKey === "today" ? "text-primary" : "text-muted-foreground"
                        )}>{getGroupLabel(groupKey)}</span>
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {items.length} job{items.length !== 1 ? "s" : ""} · {formatCurrency(groupTotal)}
                      </span>
                    </button>

                    {!isCollapsed && items.map(({ job, customer }) => {
                      const isToday = job.date === todayStr;
                      const d = new Date(job.date + "T12:00:00");
                      const dayLabel = isToday ? "Today"
                        : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
                      return (
                        <div key={job.id} className={cn(
                          "flex items-center justify-between px-4 py-2.5 border-b border-border/40 last:border-b-0 transition-colors",
                          isToday ? "bg-primary/[0.03]" : "hover:bg-muted/20"
                        )}>
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", isToday ? "bg-primary" : "bg-border")} />
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

        {/* Overdue Cleans */}
        <div className="animate-fade-up bg-card rounded-md overflow-hidden border border-border flex flex-col" style={{ animationDelay: "0.23s" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              <span className="text-[13px] font-semibold text-foreground">Overdue Cleans</span>
            </div>
            {stats.overdueCustomers.length > 0
              ? <span className="rounded bg-warning/15 border border-warning/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">{stats.overdueCustomers.length} overdue</span>
              : <CheckCircle2 className="h-4 w-4 text-success/50" />}
          </div>

          <div className="overflow-y-auto max-h-72">
            {stats.overdueCustomers.length === 0 ? (
              <div className="py-10 text-center flex flex-col items-center gap-2">
                <CheckCircle2 className="h-7 w-7 text-success/30" />
                <p className="text-[13px] text-muted-foreground">All cleans are on schedule.</p>
                {stats.snoozedCount > 0 && <p className="text-[11px] text-muted-foreground/40">{stats.snoozedCount} snoozed</p>}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {stats.overdueCustomers.map(({ customer: c, daysOverdue }) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0",
                      daysOverdue > 30 ? "bg-destructive" : "bg-warning")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{c.address}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn(
                        "font-mono text-[11px] font-semibold rounded px-1.5 py-0.5",
                        daysOverdue > 30 ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"
                      )}>{daysOverdue}d</span>
                      <span className="text-[10px] text-muted-foreground hidden sm:block">{FREQUENCY_LABELS[c.frequency]}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-muted text-muted-foreground/40 hover:text-foreground">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-card border border-border shadow-lg shadow-black/40">
                          <DropdownMenuItem className="flex items-center gap-2 text-[12px] cursor-pointer" onClick={() => markDone(c.id)}>
                            <Check className="h-3.5 w-3.5 text-success" />Mark as done today
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-border" />
                          <DropdownMenuItem className="flex items-center gap-2 text-[12px] cursor-pointer" onClick={() => snooze(c.id, 7)}>
                            <BellOff className="h-3.5 w-3.5 text-muted-foreground" />Snooze 1 week
                          </DropdownMenuItem>
                          <DropdownMenuItem className="flex items-center gap-2 text-[12px] cursor-pointer" onClick={() => snooze(c.id, 30)}>
                            <CalendarX className="h-3.5 w-3.5 text-muted-foreground" />Snooze 1 month
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

      {/* ── Outstanding Balances ── */}
      <div className="animate-fade-up bg-card rounded-md overflow-hidden border border-border" style={{ animationDelay: "0.26s" }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Banknote className="h-3.5 w-3.5 text-warning" />
            <span className="text-[13px] font-semibold text-foreground">Outstanding Balances</span>
          </div>
          {stats.totalOutstanding > 0 ? (
            <span className="rounded bg-warning/15 border border-warning/25 px-2 py-0.5 text-[10px] font-semibold text-warning font-mono">
              {formatCurrency(stats.totalOutstanding)} owed
            </span>
          ) : (
            <CheckCircle2 className="h-4 w-4 text-success/50" />
          )}
        </div>
        <div className="overflow-y-auto max-h-56">
          {stats.outstandingCustomers.length === 0 ? (
            <div className="py-8 text-center flex flex-col items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-success/30" />
              <p className="text-[13px] text-muted-foreground">All customers paid up.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {stats.outstandingCustomers.map(({ customer: c, outstanding }) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors">
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-foreground truncate">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{c.address}</p>
                  </div>
                  <span className={cn(
                    "font-mono text-[12px] font-semibold shrink-0 ml-3",
                    outstanding > 50 ? "text-destructive" : "text-warning"
                  )}>
                    {formatCurrency(outstanding)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
