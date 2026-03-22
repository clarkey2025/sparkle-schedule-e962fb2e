import { useMemo, useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/AppContext";
import { formatCurrency } from "@/lib/helpers";
import PageHeader from "@/components/PageHeader";
import {
  CalendarCheck, CheckCircle2, PoundSterling, Circle,
  MapPin, Clock, Navigation, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// ─── Fix leaflet default icon path issue with Vite ───────────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─── Haversine distance (km) ──────────────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDrive(km: number): string {
  const mins = Math.round((km / 40) * 60); // ~40 km/h avg rural
  if (mins < 60) return `~${mins} min`;
  return `~${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// ─── Custom numbered marker ───────────────────────────────────────────────────
function numberedIcon(n: number, done: boolean) {
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:${done ? "#4ade80" : "#FF1CE9"};
      color:${done ? "#111" : "#fff"};
      font-size:11px;font-weight:700;
      display:flex;align-items:center;justify-content:center;
      border:2px solid rgba(0,0,0,0.35);
      box-shadow:0 2px 8px rgba(0,0,0,0.5);
      font-family:monospace;
    ">${n}</div>`,
  });
}

// ─── Route Map ────────────────────────────────────────────────────────────────
function RouteMap({
  stops,
  activeIdx,
  onMarkerClick,
}: {
  stops: { lat: number; lng: number; name: string; done: boolean }[];
  activeIdx: number | null;
  onMarkerClick: (i: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polyRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "© OpenStreetMap contributors © CARTO",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || stops.length === 0) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    polyRef.current?.remove();

    // Add markers
    stops.forEach((s, i) => {
      const marker = L.marker([s.lat, s.lng], { icon: numberedIcon(i + 1, s.done) })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:sans-serif;min-width:120px">
            <b style="font-size:12px">${s.name}</b>
            <p style="font-size:11px;margin:4px 0 0;color:#aaa">Stop ${i + 1}</p>
          </div>`,
          { closeButton: false }
        )
        .on("click", () => onMarkerClick(i));
      markersRef.current.push(marker);
    });

    // Draw route polyline
    const latlngs = stops.map((s) => [s.lat, s.lng] as [number, number]);
    polyRef.current = L.polyline(latlngs, {
      color: "#FF1CE9",
      weight: 3,
      opacity: 0.7,
      dashArray: "6 6",
    }).addTo(map);

    // Fit bounds
    const bounds = L.latLngBounds(latlngs);
    map.fitBounds(bounds, { padding: [32, 32] });
  }, [stops, onMarkerClick]);

  // Highlight active marker
  useEffect(() => {
    if (activeIdx === null) return;
    const stop = stops[activeIdx];
    if (!stop || !mapRef.current) return;
    mapRef.current.flyTo([stop.lat, stop.lng], 14, { animate: true, duration: 0.6 });
    markersRef.current[activeIdx]?.openPopup();
  }, [activeIdx, stops]);

  return <div ref={containerRef} className="h-full w-full" />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AgendaPage() {
  const { customers, jobs, updateJob } = useApp();
  const todayStr = new Date().toISOString().slice(0, 10);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const todayJobs = useMemo(() => {
    return jobs
      .filter((j) => j.date === todayStr && j.status !== "cancelled")
      .map((j, originalIndex) => ({
        job: j,
        customer: customers.find((c) => c.id === j.customerId),
        originalIndex,
      }));
  }, [jobs, customers, todayStr]);

  const totalValue = todayJobs.reduce((s, { job }) => s + job.price, 0);
  const completedCount = todayJobs.filter(({ job }) => job.status === "completed").length;
  const earnedToday = todayJobs
    .filter(({ job }) => job.status === "completed")
    .reduce((s, { job }) => s + job.price, 0);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long",
  });

  // Build stops for map (only jobs with coordinates)
  const stops = useMemo(() =>
    todayJobs
      .filter(({ customer }) => customer?.lat && customer?.lng)
      .map(({ job, customer }) => ({
        lat: customer!.lat!,
        lng: customer!.lng!,
        name: customer!.name,
        done: job.status === "completed",
      })),
    [todayJobs]
  );

  // Build leg distances
  const legs = useMemo(() => {
    return stops.slice(1).map((s, i) => ({
      km: haversine(stops[i].lat, stops[i].lng, s.lat, s.lng),
    }));
  }, [stops]);

  const totalKm = legs.reduce((s, l) => s + l.km, 0);

  const markDone = (jobId: string) => {
    updateJob(jobId, { status: "completed" });
  };

  return (
    <div className="pb-24 md:pb-0 space-y-4">
      <PageHeader title="Today's Agenda" description={today} />

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Jobs Today",
            value: String(todayJobs.length),
            sub: `${completedCount} of ${todayJobs.length} done`,
            colour: "text-foreground",
            icon: CalendarCheck,
          },
          {
            label: "Completed",
            value: `${completedCount}/${todayJobs.length}`,
            sub: completedCount === todayJobs.length && todayJobs.length > 0 ? "All done! 🎉" : `${todayJobs.length - completedCount} remaining`,
            colour: completedCount === todayJobs.length && completedCount > 0 ? "text-success" : "text-foreground",
            icon: CheckCircle2,
          },
          {
            label: "Day's Revenue",
            value: formatCurrency(earnedToday || totalValue),
            sub: earnedToday > 0 && earnedToday < totalValue
              ? `${formatCurrency(totalValue - earnedToday)} pending`
              : `${formatCurrency(totalValue)} predicted`,
            colour: "text-primary",
            icon: PoundSterling,
          },
        ].map(({ label, value, sub, colour, icon: Icon }, i) => (
          <div
            key={label}
            className="bg-card border border-border rounded-md p-4 animate-fade-up"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="label-caps mb-2">{label}</p>
                <p className={cn("font-mono text-[22px] font-medium leading-none tracking-tight", colour)}>
                  {value}
                </p>
                <p className="mt-1.5 text-[11px] text-muted-foreground">{sub}</p>
              </div>
              <Icon className="h-4 w-4 text-muted-foreground/20 shrink-0 mt-0.5" />
            </div>
          </div>
        ))}
      </div>

      {/* ── Map + Job List side-by-side on large screens ── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px] animate-fade-up" style={{ animationDelay: "0.15s" }}>

        {/* Map */}
        <div className="bg-card border border-border rounded-md overflow-hidden flex flex-col" style={{ minHeight: 420 }}>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
            <Navigation className="h-3.5 w-3.5 text-primary" />
            <span className="text-[13px] font-semibold text-foreground">Route Map</span>
            {totalKm > 0 && (
              <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                {totalKm.toFixed(1)} km total · {fmtDrive(totalKm)}
              </span>
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
            <div className="flex-1 relative" style={{ minHeight: 360 }}>
              <RouteMap stops={stops} activeIdx={activeIdx} onMarkerClick={setActiveIdx} />
            </div>
          )}
        </div>

        {/* Job list */}
        <div className="bg-card border border-border rounded-md overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
            <CalendarCheck className="h-3.5 w-3.5 text-primary" />
            <span className="text-[13px] font-semibold text-foreground">Stops</span>
            <span className="ml-auto font-mono text-[11px] text-muted-foreground">{todayJobs.length} total</span>
          </div>

          <div className="overflow-y-auto flex-1">
            {todayJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3">
                <Circle className="h-8 w-8 text-muted-foreground/20" />
                <p className="text-[13px] text-muted-foreground">Nothing scheduled today</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {todayJobs.map(({ job, customer }, i) => {
                  const done = job.status === "completed";
                  const isActive = activeIdx === i;
                  const legKm = legs[i - 1]?.km;

                  return (
                    <div key={job.id}>
                      {/* Drive leg indicator */}
                      {legKm !== undefined && (
                        <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/20">
                          <div className="h-px flex-1 bg-border/60" />
                          <span className="text-[10px] text-muted-foreground/50 font-mono whitespace-nowrap">
                            {legKm.toFixed(1)} km · {fmtDrive(legKm)}
                          </span>
                          <div className="h-px flex-1 bg-border/60" />
                        </div>
                      )}

                      <button
                        onClick={() => setActiveIdx(isActive ? null : i)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 transition-colors text-left",
                          done ? "opacity-50" : "hover:bg-muted/20",
                          isActive && "bg-primary/[0.06]"
                        )}
                      >
                        {/* Stop number */}
                        <span
                          className={cn(
                            "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold font-mono shrink-0",
                            done
                              ? "bg-success/20 text-success"
                              : isActive
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {i + 1}
                        </span>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-[13px] font-medium leading-tight",
                            done ? "line-through text-muted-foreground" : "text-foreground"
                          )}>
                            {customer?.name ?? "Unknown"}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {customer?.address}
                          </p>
                          {customer?.notes && (
                            <p className="text-[10px] text-primary/60 mt-0.5 truncate">
                              ℹ {customer.notes}
                            </p>
                          )}
                        </div>

                        {/* Price + action */}
                        <div className="shrink-0 flex flex-col items-end gap-1.5">
                          <span className="font-mono text-[13px] font-medium text-foreground">
                            {formatCurrency(job.price)}
                          </span>
                          {done ? (
                            <span className="flex items-center gap-1 text-[10px] text-success font-medium">
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

          {/* Route summary footer */}
          {stops.length > 1 && (
            <div className="px-4 py-3 border-t border-border bg-muted/10 flex items-center gap-4">
              <Clock className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              <div className="flex gap-4 text-[11px] text-muted-foreground">
                <span>{stops.length} stops</span>
                <span className="text-border">·</span>
                <span>{totalKm.toFixed(1)} km</span>
                <span className="text-border">·</span>
                <span>{fmtDrive(totalKm)} driving</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
