import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, CalendarCheck, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/jobs", label: "Jobs", icon: CalendarCheck },
  { to: "/payments", label: "Payments", icon: CreditCard },
];

export default function MobileNav() {
  const location = useLocation();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card md:hidden">
      {links.map((link) => {
        const active = location.pathname === link.to;
        return (
          <NavLink
            key={link.to}
            to={link.to}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <link.icon className="h-5 w-5" />
            {link.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
