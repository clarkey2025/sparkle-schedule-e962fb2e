import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  message: string;
  className?: string;
}

export default function EmptyState({ icon: Icon, message, className }: EmptyStateProps) {
  return (
    <div className={cn("bg-card border border-border rounded-md py-14 text-center", className)}>
      {Icon && <Icon className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />}
      <p className="text-[13px] text-muted-foreground">{message}</p>
    </div>
  );
}
