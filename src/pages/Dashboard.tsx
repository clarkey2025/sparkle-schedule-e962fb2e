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
  CloudDrizzle,
  Wind,
  MapPin,
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
  if (code === 0) return "Clear skies";
  if (code === 1) return "Mostly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 49) return "Foggy";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  if (code <= 99) return "Thunderstorm";
  return "Unknown";
}

function wmoShort(code: number): string {
  if (code === 0) return "Clear";
  if (code === 1) return "Mostly clear";
  if (code === 2) return "Pt. cloudy";
  if (code === 3) return "Overcast";
  if (code <= 49) return "Foggy";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  if (code <= 99) return "Storm";
  return "—";
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

function cleaningSuitability(code: number): { label: string; good: boolean; colour: string } {
  if (code === 0) return { label: "Perfect day to clean", good: true, colour: "text-primary" };
  if (code === 1) return { label: "Great for cleaning", good: true, colour: "text-primary" };
  if (code === 2) return { label: "Should be fine", good: true, colour: "text-success" };
  if (code === 3) return { label: "Manageable", good: false, colour: "text-muted-foreground" };
  if (code <= 57) return { label: "Light drizzle — risky", good: false, colour: "text-warning" };
  if (code <= 67 || (code >= 80 && code <= 82)) return { label: "Rain — avoid if possible", good: false, colour: "text-destructive" };
  if (code <= 99) return { label: "Don't bother", good: false, colour: "text-destructive" };
  return { label: "Check forecast", good: false, colour: "text-muted-foreground" };
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { customers, jobs, payments } = useApp();
  const navigate = useNavigate();
  const now = new Date();

  const [weather, setWeather] = useState<WeatherDay[] | null>(null);
  const [locationName, setLocationName] = useState<string>("");
  const [weatherError, setWeatherError] = useState(false);

  useEffect(() => {
    async function fetchWeather(lat: number, lon: number) {
      try {
        const [weatherRes, geoRes] = await Promise.all([
          fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7`
          ),
          fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
          ),
        ]);
        const weatherData = await weatherRes.json();
        const geoData = await geoRes.json();

        const town =
          geoData?.address?.town ||
          geoData?.address?.city ||
          geoData?.address?.village ||
          geoData?.address?.county ||
          "";
        setLocationName(town);

        const days: WeatherDay[] = weatherData.daily.time.map((t: string, i: number) => ({
          date: t,
          code: weatherData.daily.weathercode[i],
          max: Math.round(weatherData.daily.temperature_2m_max[i]),
          min: Math.round(weatherData.daily.temperature_2m_min[i]),
        }));
        setWeather(days);
      } catch {
        setWeatherError(true);
      }
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => fetchWeather(51.5, -0.12)
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
        return { customer: c, daysOverdue };
      })
      .filter(({ daysOverdue }) => daysOverdue > 0)
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    const todayStr = now.toISOString().slice(0, 10);

    const upcomingJobs = jobs
      .filter((j) => j.status === "scheduled" && j.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8)
      .map((j) => ({ job: j, customer: customers.find((c) => c.id === j.customerId) }));

    const todayCount = upcomingJobs.filter(({ job }) => job.date === todayStr).length;

    const thisMonthRevenue = payments
      .filter((p) => {
        const d = new Date(p.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, p) => s + p.amount, 0);

    return { overdueCustomers, upcomingJobs, todayCount, thisMonthRevenue };
  }, [customers, jobs, payments]);

  const todayStr = now.toISOString().slice(0, 10);
  const today = weather?.[0];
  const todaySuitability = today ? cleaningSuitability(today.code) : null;
  const goodDaysThisWeek = weather?.filter((d) => cleaningSuitability(d.code).good).length ?? 0;

  return (
    <div className="pb-24 md:pb-0 space-y-4">

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Total Customers",
            value: String(customers.length),
            sub: customers.length === 1 ? "property on round" : "properties on round",
            icon: Users,
            border: "border-l-2 border-l-muted-foreground/20",
            num: "text-foreground",
            delay: "0.04s",
          },
          {
            label: "Overdue Jobs",
            value: String(stats.overdueCustomers.length),
            sub: stats.overdueCustomers.length === 0 ? "All up to date" : "Need scheduling",
            icon: AlertTriangle,
            border: stats.overdueCustomers.length > 0 ? "border-l-2 border-l-warning" : "border-l-2 border-l-success",
            num: stats.overdueCustomers.length > 0 ? "text-warning" : "text-success",
            delay: "0.08s",
          },
          {
            label: "Monthly Revenue",
            value: formatCurrency(stats.thisMonthRevenue),
            sub: now.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
            icon: PoundSterling,
            border: "border-l-2 border-l-primary",
            num: "text-primary",
            delay: "0.12s",
          },
        ].map(({ label, value, sub, icon: Icon, border, num, delay }) => (
          <div
            key={label}
            className={cn("bg-card rounded-md p-5 animate-fade-up", border)}
            style={{ animationDelay: delay }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="label-caps mb-3">{label}</p>
                <p className={cn("font-mono text-[26px] font-medium leading-none tracking-tight", num)}>{value}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">{sub}</p>
              </div>
              <Icon className="h-4 w-4 text-muted-foreground/30 shrink-0 mt-0.5" />
            </div>
          </div>
        ))}
      </div>

      {/* ── Scheduled + Overdue ── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Scheduled Jobs */}
        <div className="animate-fade-up bg-card rounded-md overflow-hidden border border-border" style={{ animationDelay: "0.16s" }}>
          <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <CalendarCheck className="h-3.5 w-3.5 text-primary" />
                <span className="text-[13px] font-semibold text-foreground">Scheduled Jobs</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[22px] font-medium leading-none text-primary">{stats.todayCount}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">today</p>
            </div>
          </div>

          {stats.upcomingJobs.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-[13px] text-muted-foreground">No jobs scheduled yet.</p>
              <p className="text-[11px] text-muted-foreground/50 mt-1">Head to Jobs to add some.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {stats.upcomingJobs.map(({ job, customer }) => {
                const isToday = job.date === todayStr;
                const d = new Date(job.date + "T12:00:00");
                const dayLabel = isToday
                  ? "Today"
                  : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
                return (
                  <div
                    key={job.id}
                    className={cn(
                      "flex items-center justify-between px-4 py-3 transition-colors",
                      isToday ? "bg-primary/[0.04]" : "hover:bg-muted/20"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", isToday ? "bg-primary" : "bg-border")} />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">{customer?.name ?? "Unknown"}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{customer?.address}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className={cn("text-[11px] font-semibold", isToday ? "text-primary" : "text-muted-foreground")}>{dayLabel}</p>
                      <p className="font-mono text-[12px] text-foreground">{formatCurrency(job.price)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Overdue Cleans */}
        <div className="animate-fade-up bg-card rounded-md overflow-hidden border border-border" style={{ animationDelay: "0.2s" }}>
          <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                <span className="text-[13px] font-semibold text-foreground">Overdue Cleans</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {stats.overdueCustomers.length === 0 ? "Everyone's up to date" : "Sorted by most overdue"}
              </p>
            </div>
            <div className="text-right">
              <p className={cn(
                "font-mono text-[22px] font-medium leading-none",
                stats.overdueCustomers.length > 0 ? "text-warning" : "text-success"
              )}>
                {stats.overdueCustomers.length}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">overdue</p>
            </div>
          </div>

          {stats.overdueCustomers.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <CheckCircle2 className="h-7 w-7 text-success/40 mx-auto mb-2" />
              <p className="text-[13px] text-muted-foreground">Nothing to worry about.</p>
              <p className="text-[11px] text-muted-foreground/50 mt-1">All cleans are on schedule.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {stats.overdueCustomers.slice(0, 7).map(({ customer: c, daysOverdue }) => (
                <div
                  key={c.id}
                  className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors group"
                  onClick={() => navigate("/customers")}
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      daysOverdue > 14 ? "bg-destructive" : "bg-warning"
                    )} />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{c.address}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <div className="text-right">
                      <p className={cn(
                        "font-mono text-[12px] font-semibold",
                        daysOverdue > 14 ? "text-destructive" : "text-warning"
                      )}>
                        {daysOverdue}d late
                      </p>
                      <p className="text-[10px] text-muted-foreground">{FREQUENCY_LABELS[c.frequency]}</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Weather ── */}
      <div className="animate-fade-up bg-card rounded-md overflow-hidden border border-border" style={{ animationDelay: "0.26s" }}>

        {/* Today hero */}
        {!weatherError && (
          <div className="flex items-stretch border-b border-border">
            {/* Today big panel */}
            <div className="flex-1 px-5 py-5 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 mb-3">
                {locationName ? (
                  <>
                    <MapPin className="h-3 w-3 text-muted-foreground/50" />
                    <span className="text-[11px] text-muted-foreground">{locationName}</span>
                  </>
                ) : (
                  <span className="label-caps">Today's forecast</span>
                )}
              </div>

              {!today ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-10 w-24 rounded bg-muted" />
                  <div className="h-3 w-32 rounded bg-muted" />
                </div>
              ) : (
                <>
                  <div className="flex items-end gap-4">
                    <WeatherIcon
                      code={today.code}
                      className="h-10 w-10 text-primary shrink-0"
                    />
                    <div>
                      <p className="font-mono text-[36px] font-medium leading-none text-foreground">{today.max}°<span className="text-[18px] text-muted-foreground font-normal">C</span></p>
                      <p className="text-[12px] text-muted-foreground mt-1">{wmoLabel(today.code)} · low {today.min}°</p>
                    </div>
                  </div>
                  {todaySuitability && (
                    <p className={cn("text-[12px] font-medium mt-3", todaySuitability.colour)}>
                      {todaySuitability.good ? "✓" : "✗"} {todaySuitability.label}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Good days this week stat */}
            {weather && (
              <div className="flex flex-col items-center justify-center px-6 border-l border-border gap-1 bg-muted/20 min-w-[100px]">
                <p className="font-mono text-[32px] font-medium leading-none text-primary">{goodDaysThisWeek}</p>
                <p className="text-[10px] text-muted-foreground text-center leading-tight">good days<br />this week</p>
              </div>
            )}
          </div>
        )}

        {/* 7-day strip */}
        {weatherError ? (
          <div className="px-4 py-6 text-center">
            <p className="text-[13px] text-muted-foreground">Weather data unavailable.</p>
          </div>
        ) : !weather ? (
          <div className="flex">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 px-2 py-3 border-r border-border last:border-r-0 animate-pulse">
                <div className="h-2 w-8 rounded bg-muted" />
                <div className="h-5 w-5 rounded bg-muted" />
                <div className="h-2 w-6 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex overflow-x-auto">
            {weather.map((day, i) => {
              const d = new Date(day.date + "T12:00:00");
              const dayName = i === 0 ? "Today" : d.toLocaleDateString("en-GB", { weekday: "short" });
              const suit = cleaningSuitability(day.code);
              return (
                <div
                  key={day.date}
                  className={cn(
                    "flex-1 min-w-[68px] flex flex-col items-center gap-1 px-1 py-3 border-r border-border last:border-r-0 transition-colors",
                    suit.good && i !== 0 ? "bg-primary/[0.04]" : "",
                    i === 0 ? "bg-muted/30" : ""
                  )}
                >
                  <p className={cn(
                    "text-[10px] font-semibold tracking-wide uppercase",
                    i === 0 ? "text-primary" : "text-muted-foreground/60"
                  )}>
                    {dayName}
                  </p>
                  <WeatherIcon
                    code={day.code}
                    className={cn(
                      "h-4 w-4 my-0.5",
                      suit.good ? "text-primary" : "text-muted-foreground/40"
                    )}
                  />
                  <p className="text-[10px] text-muted-foreground/70 text-center leading-tight px-1">{wmoShort(day.code)}</p>
                  <p className="font-mono text-[11px] text-foreground/70">{day.max}°</p>
                  {suit.good && i !== 0 && (
                    <div className="h-1 w-1 rounded-full bg-primary mt-0.5" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
