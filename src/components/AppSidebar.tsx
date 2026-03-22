import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, CalendarCheck, CreditCard, Droplets } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/jobs", label: "Jobs", icon: CalendarCheck },
  { to: "/payments", label: "Payments", icon: CreditCard },
];

export default function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-56 flex-col bg-sidebar animate-slide-in-left border-r border-sidebar-border">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-sidebar-primary/15">
          <Droplets className="h-4 w-4 text-sidebar-primary" />
        </div>
        <span className="text-[13px] font-semibold tracking-tight text-white">PanePro</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        <p className="label-caps px-3 mb-3">Navigation</p>
        {links.map((link) => {
          const active = location.pathname === link.to;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={cn(
                "flex items-center gap-3 rounded px-3 py-2 text-[13px] font-medium transition-all duration-150",
                active
                  ? "bg-sidebar-primary/10 text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <link.icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  active ? "text-sidebar-primary" : "text-sidebar-foreground/60"
                )}
              />
              {link.label}
              {active && (
                <span className="ml-auto h-1 w-1 rounded-full bg-sidebar-primary" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-sidebar-border">
        <p className="text-[11px] text-sidebar-foreground/30 font-mono">v1.0 · 2026</p>
      </div>
    </aside>
  );
}
