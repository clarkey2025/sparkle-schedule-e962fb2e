import { Button } from "@/components/ui/button";
import { Trash2, X, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface BulkAction {
  label: string;
  icon?: React.ReactNode;
  variant?: "default" | "destructive" | "outline" | "ghost";
  onClick: () => void;
}

interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  actions: BulkAction[];
  className?: string;
}

export default function BulkActionBar({ count, onClear, actions, className }: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md bg-primary/10 border border-primary/20 animate-fade-up",
        className,
      )}
    >
      <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="text-[12px] font-medium text-primary tabular-nums">
        {count} selected
      </span>
      <div className="flex items-center gap-1 ml-auto">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant={action.variant === "destructive" ? "destructive" : "outline"}
            size="sm"
            className="h-7 text-[11px] px-2.5"
            onClick={action.onClick}
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onClear}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
