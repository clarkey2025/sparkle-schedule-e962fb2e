import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  className?: string;
}

export default function StatCard({ label, value, icon: Icon, className = "" }: StatCardProps) {
  return (
    <div className={cn("surface rounded-md p-5", className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="label-caps mb-2">{label}</p>
          <p className="font-mono text-2xl font-medium tracking-tight text-foreground">{value}</p>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
    </div>
  );
}
