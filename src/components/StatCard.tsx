import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  sub?: string;
  colour?: string;
  className?: string;
}

export default function StatCard({ label, value, icon: Icon, sub, colour = "text-foreground", className }: StatCardProps) {
  return (
    <div className={cn("bg-card border border-border rounded-md p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <p className="label-caps">{label}</p>
        <div className={cn("h-7 w-7 rounded-md flex items-center justify-center bg-muted/40", colour)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className={cn("font-mono text-xl", colour)}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}
