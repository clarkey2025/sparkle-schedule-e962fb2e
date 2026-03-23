import { useLocation } from "react-router-dom";
import bucketListIcon from "@/assets/bucket-list-icon.png";

const TITLES: Record<string, { label: string; desc: string }> = {
  "/": { label: "Dashboard", desc: "Your business at a glance" },
  "/customers": { label: "Customers", desc: "Manage your client list" },
  "/jobs": { label: "Jobs", desc: "Schedule and track cleans" },
  "/payments": { label: "Payments", desc: "Record and review earnings" },
  "/agenda": { label: "Today's Agenda", desc: "What's on for today" },
  "/route": { label: "Route Planner", desc: "Plan your cleaning round" },
  "/rounds": { label: "Rounds", desc: "Organise your cleaning rounds" },
};

export default function TopBar() {
  const location = useLocation();
  const meta = TITLES[location.pathname] ?? { label: "Bucket List", desc: "" };

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/95 backdrop-blur-sm px-6">
      <div>
        <h2 className="text-sm font-semibold leading-none text-foreground">{meta.label}</h2>
        {meta.desc && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{meta.desc}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 rounded bg-primary/10 px-2.5 py-1">
        <img src={bucketListIcon} alt="Bucket List" className="h-4 w-4" />
        <span className="text-[12px] font-semibold text-primary tracking-tight">Bucket List</span>
      </div>
    </header>
  );
}
