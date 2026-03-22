import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { useApp } from "@/lib/AppContext";
import { formatCurrency } from "@/lib/helpers";
import PageHeader from "@/components/PageHeader";
import {
  CalendarCheck, CheckCircle2, PoundSterling, Circle,
  MapPin, Clock, Navigation, ChevronRight, Route,
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
interface Stop { lat: number; lng: number; name: string; address: string; notes: string; done: boolean; }
interface LegInfo { distance: number; duration: number; } // metres, seconds

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

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      scrollWheelZoom: true,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Dark tiles — CartoDB Dark Matter
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution: "© OpenStreetMap contributors © CARTO",
        maxZoom: 19,
        subdomains: "abcd",
      }
    ).addTo(map);

    mapRef.current = map;
  }, []);

  // Render route path
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    routeLayerRef.current?.remove();
    if (routePath.length > 1) {
      routeLayerRef.current = L.polyline(routePath, {
        color: "#FF1CE9",
        weight: 4,
        opacity: 0.85,
        lineJoin: "round",
        lineCap: "round",
      }).addTo(map);
    }
  }, [routePath]);

  // Render markers + leg labels
  useEffect(() => {
    const map = mapRef.current;
    if (!map || stops.length === 0) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    legLabelsRef.current.forEach((m) => m.remove());
    legLabelsRef.current = [];

    stops.forEach((s, i) => {
      const isActive = i === activeIdx;
      const marker = L.marker([s.lat, s.lng], { icon: numberedIcon(i + 1, s.done, isActive), zIndexOffset: isActive ? 1000 : 0 })
        .addTo(map)
        .on("click", () => onMarkerClick(i));
      markersRef.current.push(marker);
    });

    // Mid-leg duration labels
    legs.forEach((leg, i) => {
      const a = stops[i], b = stops[i + 1];
      if (!a || !b) return;
      const midLat = (a.lat + b.lat) / 2;
      const midLng = (a.lng + b.lng) / 2;
      const label = L.marker([midLat, midLng], {
        icon: L.divIcon({
          className: "",
          iconSize: [72, 22],
          iconAnchor: [36, 11],
          html: `<div style="
            background:rgba(255,255,255,0.92);
            border:1px solid rgba(255,28,233,0.35);
            border-radius:99px;
            padding:2px 8px;
            font-size:10px;font-weight:600;font-family:monospace;
            color:#333;
            white-space:nowrap;
            box-shadow:0 1px 4px rgba(0,0,0,0.12);
          ">${fmtDuration(leg.duration)} · ${fmtDist(leg.distance)}</div>`,
        }),
        interactive: false,
        zIndexOffset: -500,
      }).addTo(map);
      legLabelsRef.current.push(label);
    });

    // Fit bounds on first load
    if (!didFit.current && stops.length > 0) {
      const bounds = L.latLngBounds(stops.map((s) => [s.lat, s.lng]));
      map.fitBounds(bounds, { padding: [48, 48] });
      didFit.current = true;
    }
  }, [stops, legs, activeIdx, onMarkerClick]);

  // Pan to active
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
        .leaflet-tooltip-clean {
          background: white;
          border: 1px solid rgba(0,0,0,0.1);
          border-radius: 6px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
          padding: 4px 8px;
          font-size: 12px;
        }
        .leaflet-tooltip-clean::before { display: none; }
        .leaflet-control-zoom a {
          background: white !important;
          color: #333 !important;
          border-color: rgba(0,0,0,0.1) !important;
          font-size: 16px !important;
        }
        .leaflet-control-attribution { font-size: 9px !important; opacity: 0.5; }
        .leaflet-container { font-family: system-ui, sans-serif; }
      `}</style>
      <div ref={containerRef} className="h-full w-full" />
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AgendaPage() {
  const { customers, jobs, updateJob } = useApp();
  const todayStr = new Date().toISOString().slice(0, 10);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [routeData, setRouteData] = useState<{ path: [number, number][]; legs: LegInfo[]; totalDistance: number; totalDuration: number } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const todayJobs = useMemo(() =>
    jobs
      .filter((j) => j.date === todayStr && j.status !== "cancelled")
      .map((j) => ({ job: j, customer: customers.find((c) => c.id === j.customerId) })),
    [jobs, customers, todayStr]
  );

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
  }, [stops.map((s) => `${s.lat},${s.lng},${s.done}`).join("|")]);

  const totalValue = todayJobs.reduce((s, { job }) => s + job.price, 0);
  const completedCount = todayJobs.filter(({ job }) => job.status === "completed").length;
  const earnedToday = todayJobs.filter(({ job }) => job.status === "completed").reduce((s, { job }) => s + job.price, 0);

  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const markDone = useCallback((jobId: string) => {
    updateJob(jobId, { status: "completed" });
  }, [updateJob]);

  return (
    <div className="pb-24 md:pb-0 space-y-4">
      <PageHeader title="Today's Agenda" description={today} />

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-3 gap-3">
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

      {/* ── Map + Job list ── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px] animate-fade-up" style={{ animationDelay: "0.15s" }}>

        {/* Map */}
        <div className="bg-card border border-border rounded-md overflow-hidden flex flex-col" style={{ minHeight: 440 }}>
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border shrink-0">
            <Navigation className="h-3.5 w-3.5 text-primary" />
            <span className="text-[13px] font-semibold text-foreground">Route Map</span>
            {routeLoading && (
              <span className="text-[11px] text-muted-foreground/50 ml-1 animate-pulse">Calculating route…</span>
            )}
            {routeData && !routeLoading && (
              <div className="ml-auto flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Route className="h-3 w-3" />
                  {fmtDist(routeData.totalDistance)}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {fmtDuration(routeData.totalDuration)}
                </span>
              </div>
            )}
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
            <div className="flex-1 relative" style={{ minHeight: 380 }}>
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

        {/* Stop list */}
        <div className="bg-card border border-border rounded-md overflow-hidden flex flex-col">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border shrink-0">
            <CalendarCheck className="h-3.5 w-3.5 text-primary" />
            <span className="text-[13px] font-semibold text-foreground">Stops</span>
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
                      {/* Drive leg */}
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

          {routeData && (
            <div className="px-4 py-2.5 border-t border-border bg-muted/10 flex items-center gap-3">
              <Clock className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
              <span className="text-[11px] text-muted-foreground">
                {stops.length} stops · {fmtDist(routeData.totalDistance)} · {fmtDuration(routeData.totalDuration)} driving
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
