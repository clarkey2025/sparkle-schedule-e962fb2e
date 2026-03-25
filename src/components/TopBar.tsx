import { useLocation, useNavigate } from "react-router-dom";
import { Bell, Settings, ChevronDown, User, LogOut, HelpCircle, FileText } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/lib/AppContext";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import bucketListIcon from "@/assets/bucket-list-icon.png";

const TITLES: Record<string, { label: string; desc: string }> = {
  "/": { label: "Dashboard", desc: "Your business at a glance" },
  "/customers": { label: "Customers", desc: "Manage your client list" },
  "/jobs": { label: "Jobs", desc: "Schedule and track cleans" },
  "/payments": { label: "Payments", desc: "Record and review earnings" },
  "/agenda": { label: "Today's Agenda", desc: "What's on for today" },
  "/route": { label: "Route Planner", desc: "Plan your cleaning round" },
  "/rounds": { label: "Rounds", desc: "Organise your cleaning rounds" },
  "/services": { label: "Services", desc: "Manage your service offerings" },
  "/finances": { label: "Finances", desc: "Track income and expenses" },
  "/quotes": { label: "Quotes", desc: "Create and manage quotes" },
  "/settings": { label: "Settings", desc: "Business details and preferences" },
};

export default function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { businessSettings, quotes } = useApp();
  const meta = TITLES[location.pathname] ?? { label: "Bucket List", desc: "" };

  // Compute expiring/expired quote notifications
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 3);

  const expiringQuotes = quotes.filter((q) => {
    if (q.status === "accepted" || q.status === "declined") return false;
    const exp = new Date(q.validUntil);
    exp.setHours(0, 0, 0, 0);
    return exp <= soon;
  });

  const notifCount = expiringQuotes.length;

  const initials = businessSettings.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "BL";

  return (
    <header className="sticky top-0 z-20 flex h-12 md:h-14 items-center justify-between border-b border-border bg-background/95 backdrop-blur-sm px-3 md:px-6 gap-2">
      {/* Page title */}
      <div className="min-w-0 flex-1">
        <h2 className="text-[13px] md:text-sm font-semibold leading-none text-foreground truncate">{meta.label}</h2>
        {meta.desc && (
          <p className="mt-0.5 text-[11px] text-muted-foreground hidden sm:block">{meta.desc}</p>
        )}
      </div>

      {/* Right-side actions */}
      <div className="flex items-center gap-0.5 md:gap-1.5 shrink-0">

        {/* Brand chip — hidden on small screens */}
        <div className="hidden lg:flex items-center gap-1.5 rounded bg-primary/10 px-2.5 py-1 mr-1">
          <img src={bucketListIcon} alt="Bucket List" className="h-4 w-4" />
          <span className="text-[12px] font-semibold text-primary tracking-tight">Bucket List</span>
        </div>

        {/* Notifications bell */}
        <NotificationsDropdown
          count={notifCount}
          quotes={expiringQuotes}
          onNavigate={() => navigate("/quotes")}
        />

        {/* Account dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1 rounded-lg px-1 py-1 hover:bg-muted transition-colors focus:outline-none">
              <Avatar className="h-6 w-6 md:h-7 md:w-7">
                {businessSettings.logoUrl && <AvatarImage src={businessSettings.logoUrl} alt={businessSettings.name} />}
                <AvatarFallback className="text-[9px] md:text-[10px] font-bold bg-primary/15 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:block text-[12px] font-medium text-foreground max-w-[120px] truncate">
                {businessSettings.name}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden md:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal pb-1">
              <p className="text-[13px] font-semibold text-foreground truncate">{businessSettings.name}</p>
              {businessSettings.email && (
                <p className="text-[11px] text-muted-foreground truncate">{businessSettings.email}</p>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
              <Settings className="h-4 w-4 mr-2 text-muted-foreground" />
              Business Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/quotes")} className="cursor-pointer">
              <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
              Quotes
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer text-muted-foreground">
              <HelpCircle className="h-4 w-4 mr-2" />
              Help &amp; Support
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

// ── Notifications sub-component ──────────────────────────────────────────────
function NotificationsDropdown({
  count,
  quotes,
  onNavigate,
}: {
  count: number;
  quotes: { id: string; quoteNumber: string; validUntil: string; prospectName?: string; customerId: string }[];
  onNavigate: () => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative flex h-8 w-8 md:h-8 md:w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors focus:outline-none">
          <Bell className="h-4 w-4 md:h-4.5 md:w-4.5 text-muted-foreground" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {count > 0 && (
            <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
              {count} new
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {count === 0 ? (
          <div className="px-3 py-4 text-center text-[12px] text-muted-foreground">
            You're all caught up 🎉
          </div>
        ) : (
          quotes.map((q) => {
            const exp = new Date(q.validUntil);
            exp.setHours(0, 0, 0, 0);
            const isExpired = exp < today;
            const daysLeft = Math.round((exp.getTime() - today.getTime()) / 86400000);
            return (
              <DropdownMenuItem
                key={q.id}
                onClick={onNavigate}
                className="cursor-pointer flex flex-col items-start gap-0.5 py-2.5"
              >
                <div className="flex items-center gap-1.5 w-full">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-[12px] font-medium">
                    {q.quoteNumber} — {q.prospectName || "Customer"}
                  </span>
                  <span className={cn(
                    "ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded",
                    isExpired
                      ? "bg-destructive/15 text-destructive"
                      : "bg-warning/15 text-warning"
                  )}>
                    {isExpired ? "Expired" : daysLeft === 0 ? "Today" : `${daysLeft}d`}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground pl-5">
                  {isExpired ? "This quote has expired" : `Expires in ${daysLeft === 0 ? "today" : `${daysLeft} day${daysLeft !== 1 ? "s" : ""}`}`}
                </span>
              </DropdownMenuItem>
            );
          })
        )}
        {count > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onNavigate} className="cursor-pointer justify-center text-[12px] text-primary font-medium">
              View all quotes →
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
