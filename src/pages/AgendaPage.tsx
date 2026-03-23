import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { useApp } from "@/lib/AppContext";
import { formatCurrency } from "@/lib/helpers";
import PageHeader from "@/components/PageHeader";
import {
  CalendarCheck, CheckCircle2, PoundSterling, Circle,
  MapPin, Clock, Navigation, ChevronRight, Route, Maximize2, X,
  Shuffle, RotateCcw, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// ─── Leaflet icon fix ─────────────────────────────────────────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─── Types ────────────────────────────────────────────────────────────────────
interface Stop { lat: number; lng: number; name: string; address: string; notes: string; done: boolean; jobId: string; }
interface LegInfo { distance: number; duration: number; }

// ─── Haversine distance (metres) ─────────────────────────────────────────────
function haversine(a: Stop, b: Stop): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ─── Nearest-neighbour TSP ────────────────────────────────────────────────────
function nearestNeighbour(stops: Stop[]): Stop[] {
  if (stops.length <= 2) return [...stops];
  // Keep completed stops in their position, only reorder pending ones
  const pending = stops.filter((s) => !s.done);
  const done = stops.filter((s) => s.done);
  if (pending.length <= 1) return [...stops];

  const visited = new Array(pending.length).fill(false);
  const ordered: Stop[] = [pending[0]];
  visited[0] = true;

  for (let step = 1; step < pending.length; step++) {
    const current = ordered[step - 1];
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let j = 0; j < pending.length; j++) {
      if (visited[j]) continue;
      const d = haversine(current, pending[j]);
      if (d < bestDist) { bestDist = d; bestIdx = j; }
    }
    visited[bestIdx] = true;
    ordered.push(pending[bestIdx]);
  }

  // Completed jobs stay at the front
  return [...done, ...ordered];
}

// ─── OSRM routing ─────────────────────────────────────────────────────────────
async function fetchOsrmRoute(stops: Stop[]): Promise<{
  path: [number, number][];
  legs: LegInfo[];
  totalDistance: number;
  totalDuration: number;
} | null> {
  if (stops.length < 2) return null;
  const coords = stops.map((s) => `${s.lng},${s.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.routes?.[0]) return null;
    const route = data.routes[0];
    const path: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng]
    );
    const legs: LegInfo[] = route.legs.map((l: { distance: number; duration: number }) => ({
      distance: l.distance,
      duration: l.duration,
    }));
    return { path, legs, totalDistance: route.distance, totalDuration: route.duration };
  } catch {
    return null;
  }
}

function fmtDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
function fmtDist(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

// ─── Numbered marker ──────────────────────────────────────────────────────────
function numberedIcon(n: number, done: boolean, active: boolean) {
  const bg = done ? "#22c55e" : active ? "#ffffff" : "#FF1CE9";
  const fg = done ? "#fff" : active ? "#FF1CE9" : "#fff";
  const border = done ? "#16a34a" : active ? "#FF1CE9" : "rgba(0,0,0,0.25)";
  const size = active ? 34 : 28;
  const shadow = active
    ? "0 0 0 3px rgba(255,28,233,0.3), 0 4px 12px rgba(0,0,0,0.35)"
    : "0 2px 8px rgba(0,0,0,0.3)";
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${bg};color:${fg};
      font-size:${active ? 13 : 11}px;font-weight:800;font-family:monospace;
      display:flex;align-items:center;justify-content:center;
      border:2px solid ${border};
      box-shadow:${shadow};
      transition:all 0.2s;
    ">${n}</div>`,
  });
}

// ─── Map component ────────────────────────────────────────────────────────────
function RouteMap({
  stops, activeIdx, legs, routePath, onMarkerClick,
}: {
  stops: Stop[];
  activeIdx: number | null;
  legs: LegInfo[];
  routePath: [number, number][];
  onMarkerClick: (i: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const legLabelsRef = useRef<L.Marker[]>([]);
  const didFit = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false, scrollWheelZoom: true });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "© OpenStreetMap contributors © CARTO",
      maxZoom: 19,
      subdomains: "abcd",
    }).addTo(map);
    mapRef.current = map;
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    routeLayerRef.current?.remove();
    if (routePath.length > 1) {
      routeLayerRef.current = L.polyline(routePath, {
        color: "#FF1CE9", weight: 4, opacity: 0.85, lineJoin: "round", lineCap: "round",
      }).addTo(map);
    }
  }, [routePath]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || stops.length === 0) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    legLabelsRef.current.forEach((m) => m.remove());
    legLabelsRef.current = [];
    stops.forEach((s, i) => {
      const isActive = i === activeIdx;
      const marker = L.marker([s.lat, s.lng], {
        icon: numberedIcon(i + 1, s.done, isActive),
        zIndexOffset: isActive ? 1000 : 0,
      }).addTo(map).on("click", () => onMarkerClick(i));
      markersRef.current.push(marker);
    });
    if (!didFit.current && stops.length > 0) {
      const bounds = L.latLngBounds(stops.map((s) => [s.lat, s.lng]));
      map.fitBounds(bounds, { padding: [48, 48] });
      didFit.current = true;
    }
  }, [stops, legs, activeIdx, onMarkerClick]);

  useEffect(() => {
    const map = mapRef.current;
    if (activeIdx === null || !map) return;
    const s = stops[activeIdx];
    if (!s) return;
    map.flyTo([s.lat, s.lng], Math.max(map.getZoom(), 14), { duration: 0.5 });
  }, [activeIdx, stops]);

  return (
    <>
      <style>{`
        .leaflet-control-zoom a { background:#1a1a1a!important;color:rgba(255,255,255,0.7)!important;border-color:rgba(255,255,255,0.08)!important;font-size:16px!important; }
        .leaflet-control-zoom a:hover { background:#2a2a2a!important;color:#fff!important; }
        .leaflet-control-attribution { background:rgba(0,0,0,0.5)!important;color:rgba(255,255,255,0.3)!important;font-size:9px!important; }
        .leaflet-control-attribution a { color:rgba(255,255,255,0.4)!important; }
        .leaflet-container { font-family:system-ui,sans-serif; }
      `}</style>
      <div ref={containerRef} className="h-full w-full" />
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AgendaPage() {
  const { customers, jobs, addJob, updateJob } = useApp();
  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrowStr = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
  const [viewDate, setViewDate] = useState<"today" | "tomorrow">("today");
  const dateStr = viewDate === "today" ? todayStr : tomorrowStr;
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [routeData, setRouteData] = useState<{ path: [number, number][]; legs: LegInfo[]; totalDistance: number; totalDuration: number } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [optimised, setOptimised] = useState(false);
  const [stopOrder, setStopOrder] = useState<string[]>([]);  // jobId order override

  // Combine explicit jobs + customers due on the selected date (auto-create jobs for due customers)
  const todayJobsRaw = useMemo(() => {
    const existingJobs = jobs
      .filter((j) => j.date === dateStr && j.status !== "cancelled")
      .map((j) => ({ job: j, customer: customers.find((c) => c.id === j.customerId) }));

    // Find customers due on this date who don't already have a job
    const customerIdsWithJobs = new Set(existingJobs.map((e) => e.job.customerId));
    const dueCustomers = customers.filter((c) =>
      c.nextDueDate === dateStr && !customerIdsWithJobs.has(c.id)
    );

    // Create virtual job entries for due customers
    const virtualJobs = dueCustomers.map((c) => ({
      job: {
        id: `virtual-${c.id}`,
        customerId: c.id,
        date: dateStr,
        status: "scheduled" as const,
        price: c.pricePerClean,
        notes: "",
      },
      customer: c,
    }));

    return [...existingJobs, ...virtualJobs];
  }, [jobs, customers, dateStr]);

  // Apply custom stop order when optimised
  const todayJobs = useMemo(() => {
    if (!optimised || stopOrder.length === 0) return todayJobsRaw;
    const map = new Map(todayJobsRaw.map((e) => [e.job.id, e]));
    const ordered = stopOrder.map((id) => map.get(id)).filter(Boolean) as typeof todayJobsRaw;
    // Append any jobs not in the order (safety net)
    const rest = todayJobsRaw.filter((e) => !stopOrder.includes(e.job.id));
    return [...ordered, ...rest];
  }, [todayJobsRaw, optimised, stopOrder]);

  const stops: Stop[] = useMemo(() =>
    todayJobs
      .filter(({ customer }) => customer?.lat && customer?.lng)
      .map(({ job, customer }) => ({
        lat: customer!.lat!,
        lng: customer!.lng!,
        name: customer!.name,
        address: customer!.address,
        notes: customer!.notes,
        done: job.status === "completed",
        jobId: job.id,
      })),
    [todayJobs]
  );

  // Fetch OSRM route whenever stops change
  useEffect(() => {
    if (stops.length < 2) { setRouteData(null); return; }
    setRouteLoading(true);
    fetchOsrmRoute(stops).then((r) => {
      setRouteData(r);
      setRouteLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops.map((s) => `${s.lat},${s.lng},${s.done}`).join("|")]);

  const totalValue = todayJobs.reduce((s, { job }) => s + job.price, 0);
  const completedCount = todayJobs.filter(({ job }) => job.status === "completed").length;
  const earnedToday = todayJobs.filter(({ job }) => job.status === "completed").reduce((s, { job }) => s + job.price, 0);
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const markDone = useCallback((jobId: string) => {
    updateJob(jobId, { status: "completed" });
  }, [updateJob]);

  const handleOptimise = useCallback(() => {
    if (stops.length < 2) return;
    const optimisedStops = nearestNeighbour(stops);
    setStopOrder(optimisedStops.map((s) => s.jobId));
    setOptimised(true);
    setActiveIdx(null);
  }, [stops]);

  const handleReset = useCallback(() => {
    setOptimised(false);
    setStopOrder([]);
    setActiveIdx(null);
  }, []);

  // ── Stops panel ──────────────────────────────────────────────────────────────
 const stopsPanel = (
   <div className="bg-card border border-border rounded-md overflow-hidden flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border shrink-0">
        <CalendarCheck className="h-3.5 w-3.5 text-primary" />
        <span className="text-[13px] font-semibold text-foreground">Stops</span>
        {optimised && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            <Sparkles className="h-2.5 w-2.5" /> Optimised
          </span>
        )}
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">{todayJobs.length} total</span>
      </div>

      <div className="overflow-y-auto flex-1">
        {todayJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <Circle className="h-7 w-7 text-muted-foreground/20" />
            <p className="text-[13px] text-muted-foreground">Nothing scheduled today</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {todayJobs.map(({ job, customer }, i) => {
              const done = job.status === "completed";
              const isActive = activeIdx === i;
              const leg = routeData?.legs[i - 1];

              return (
                <div key={job.id}>
                  {leg && (
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/20">
                      <div className="flex flex-col items-center gap-0.5 pl-2.5">
                        <div className="h-1.5 w-px bg-border/60" />
                        <div className="h-1.5 w-px bg-border/60" />
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground/50">
                        {fmtDuration(leg.duration)} · {fmtDist(leg.distance)}
                      </span>
                    </div>
                  )}

                  <button
                    onClick={() => setActiveIdx(isActive ? null : i)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                      done ? "opacity-60" : "hover:bg-muted/20",
                      isActive && !done && "bg-primary/[0.05]"
                    )}
                  >
                    <span className={cn(
                      "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold font-mono shrink-0 transition-colors",
                      done ? "bg-success/20 text-success" : isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                    )}>
                      {i + 1}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-[13px] font-medium leading-tight",
                        done ? "line-through text-muted-foreground" : "text-foreground"
                      )}>
                        {customer?.name ?? "Unknown"}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{customer?.address}</p>
                      {customer?.notes && (
                        <p className="text-[10px] text-primary/60 mt-0.5 truncate">ℹ {customer.notes}</p>
                      )}
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-1.5 ml-2">
                      <span className="font-mono text-[13px] font-medium text-foreground">
                        {formatCurrency(job.price)}
                      </span>
                      {done ? (
                        <span className="flex items-center gap-1 text-[10px] text-success font-semibold">
                          <CheckCircle2 className="h-3 w-3" /> Done
                        </span>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); markDone(job.id); }}
                          className="text-[10px] text-primary font-semibold hover:underline flex items-center gap-0.5"
                        >
                          Mark done <ChevronRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer: route summary + optimise button */}
      <div className="px-4 py-2.5 border-t border-border bg-muted/10 flex items-center gap-2">
        {routeData ? (
          <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-muted-foreground/30 shrink-0" />
            {stops.length} stops · {fmtDist(routeData.totalDistance)} · {fmtDuration(routeData.totalDuration)} driving
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground/40">{stops.length} stops</span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {optimised ? (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3 w-3" /> Reset order
            </button>
          ) : (
            <button
              onClick={handleOptimise}
              disabled={stops.length < 2}
              className={cn(
                "flex items-center gap-1.5 text-[11px] font-semibold transition-colors",
                stops.length < 2
                  ? "text-muted-foreground/30 cursor-not-allowed"
                  : "text-primary hover:text-primary/80"
              )}
            >
              <Shuffle className="h-3 w-3" /> Optimise route
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // ── Fullscreen overlay ────────────────────────────────────────────────────────
  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border shrink-0 bg-card">
          <Navigation className="h-3.5 w-3.5 text-primary" />
          <span className="text-[13px] font-semibold text-foreground">Route Map</span>
          {routeLoading && (
            <span className="text-[11px] text-muted-foreground/50 ml-1 animate-pulse">Calculating route…</span>
          )}
          {routeData && !routeLoading && (
            <div className="flex items-center gap-3 ml-2">
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Route className="h-3 w-3" />{fmtDist(routeData.totalDistance)}
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />{fmtDuration(routeData.totalDuration)}
              </span>
            </div>
          )}
          {optimised && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full ml-1">
              <Sparkles className="h-2.5 w-2.5" /> Optimised
            </span>
          )}
          <button
            onClick={() => setFullscreen(false)}
            className="ml-auto flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" /> Exit Fullscreen
          </button>
        </div>
        <div className="flex-1 relative">
          <RouteMap
            stops={stops}
            activeIdx={activeIdx}
            legs={routeData?.legs ?? []}
            routePath={routeData?.path ?? stops.map((s) => [s.lat, s.lng])}
            onMarkerClick={setActiveIdx}
          />
        </div>
      </div>
    );
  }

  // ── Normal view ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 h-full min-h-0 pb-4 md:pb-0">
      <PageHeader title="Today's Agenda" description={today} />

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 shrink-0">
        {[
          {
            label: "Jobs Today",
            value: String(todayJobs.length),
            sub: todayJobs.length === 0 ? "Nothing scheduled" : `${todayJobs.length - completedCount} remaining`,
            colour: "text-foreground",
            icon: CalendarCheck,
          },
          {
            label: "Completed",
            value: `${completedCount}/${todayJobs.length}`,
            sub: completedCount === todayJobs.length && completedCount > 0 ? "All done! 🎉" : `${todayJobs.length - completedCount} to go`,
            colour: completedCount === todayJobs.length && completedCount > 0 ? "text-success" : "text-foreground",
            icon: CheckCircle2,
          },
          {
            label: "Day's Revenue",
            value: formatCurrency(earnedToday > 0 ? earnedToday : totalValue),
            sub: earnedToday > 0 && earnedToday < totalValue ? `${formatCurrency(totalValue - earnedToday)} pending` : `${formatCurrency(totalValue)} predicted`,
            colour: "text-primary",
            icon: PoundSterling,
          },
        ].map(({ label, value, sub, colour, icon: Icon }, i) => (
          <div key={label} className="bg-card border border-border rounded-md p-4 animate-fade-up" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="label-caps mb-2">{label}</p>
                <p className={cn("font-mono text-[22px] font-medium leading-none tracking-tight", colour)}>{value}</p>
                <p className="mt-1.5 text-[11px] text-muted-foreground">{sub}</p>
              </div>
              <Icon className="h-4 w-4 text-muted-foreground/20 shrink-0 mt-0.5" />
            </div>
          </div>
        ))}
      </div>

      {/* Map + stop list — fills all remaining vertical space */}
      <div className="flex-1 min-h-0 grid gap-4 lg:grid-cols-[1fr_340px] animate-fade-up" style={{ animationDelay: "0.15s" }}>

        {/* Map */}
        <div className="bg-card border border-border rounded-md overflow-hidden flex flex-col h-full min-h-0">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border shrink-0">
            <Navigation className="h-3.5 w-3.5 text-primary" />
            <span className="text-[13px] font-semibold text-foreground">Route Map</span>
            {routeLoading && (
              <span className="text-[11px] text-muted-foreground/50 ml-1 animate-pulse">Calculating route…</span>
            )}
            {routeData && !routeLoading && (
              <div className="flex items-center gap-3 ml-2">
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Route className="h-3 w-3" />{fmtDist(routeData.totalDistance)}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" />{fmtDuration(routeData.totalDuration)}
                </span>
              </div>
            )}
            <button
              onClick={() => setFullscreen(true)}
              className="ml-auto flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Maximize2 className="h-3.5 w-3.5" /> Fullscreen
            </button>
          </div>

          {stops.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 bg-muted/10">
              <MapPin className="h-8 w-8 text-muted-foreground/20" />
              <div className="text-center">
                <p className="text-[13px] text-muted-foreground font-medium">No stops to map today</p>
                <p className="text-[11px] text-muted-foreground/40 mt-0.5">Jobs with coordinates will appear here.</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 relative">
              <RouteMap
                stops={stops}
                activeIdx={activeIdx}
                legs={routeData?.legs ?? []}
                routePath={routeData?.path ?? stops.map((s) => [s.lat, s.lng])}
                onMarkerClick={setActiveIdx}
              />
            </div>
          )}
        </div>

        {stopsPanel}
      </div>
    </div>
  );
}

