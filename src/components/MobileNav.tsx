import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, CalendarCheck, CreditCard,
  ClipboardList, Route, Wrench, MoreHorizontal, CircleDot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const primaryLinks = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/agenda", label: "Agenda", icon: ClipboardList },
  { to: "/jobs", label: "Jobs", icon: CalendarCheck },
  { to: "/customers", label: "Customers", icon: Users },
];

const moreLinks = [
  { to: "/route", label: "Route", icon: Route },
  { to: "/services", label: "Services", icon: Wrench },
  { to: "/payments", label: "Payments", icon: CreditCard },
];

export default function MobileNav() {
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);
  const moreIsActive = moreLinks.some((l) => location.pathname === l.to);

  return (
    <>
      {/* Backdrop */}
      {showMore && (
        <div
          className="fixed inset-0 z-[49] bg-black/40 md:hidden"
          onClick={() => setShowMore(false)}
        />
      )}

      {/* "More" popup */}
      {showMore && (
        <div className="fixed inset-x-0 bottom-[53px] z-[50] mx-3 mb-1 rounded-xl border border-border bg-card shadow-lg md:hidden animate-fade-up">
          <div className="grid grid-cols-3 gap-1 p-2">
            {moreLinks.map((link) => {
              const active = location.pathname === link.to;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setShowMore(false)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg py-3 text-[11px] font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                  )}
                >
                  <link.icon className="h-5 w-5" />
                  {link.label}
                </NavLink>
              );
            })}
          </div>
        </div>
      )}

      {/* Main bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card md:hidden">
        {primaryLinks.map((link) => {
          const active = location.pathname === link.to;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setShowMore(false)}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium tracking-wide transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <link.icon className="h-4.5 w-4.5" />
              {link.label}
            </NavLink>
          );
        })}
        <button
          onClick={() => setShowMore((v) => !v)}
          className={cn(
            "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium tracking-wide transition-colors",
            moreIsActive || showMore ? "text-primary" : "text-muted-foreground"
          )}
        >
          <MoreHorizontal className="h-4.5 w-4.5" />
          More
        </button>
      </nav>
    </>
  );
}
