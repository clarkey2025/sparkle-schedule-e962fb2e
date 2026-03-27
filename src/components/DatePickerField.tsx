import { format, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DatePickerFieldProps {
  /** ISO date string yyyy-MM-dd */
  value?: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  className?: string;
  /** Compact filter-style variant */
  variant?: "default" | "filter";
  label?: string;
}

export default function DatePickerField({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  variant = "default",
  label,
}: DatePickerFieldProps) {
  const date = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;

  const handleSelect = (d: Date | undefined) => {
    onChange(d ? format(d, "yyyy-MM-dd") : "");
  };

  if (variant === "filter") {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "text-xs justify-start min-w-[140px] border-border",
              !date && "text-muted-foreground",
              className,
            )}
          >
            <CalendarIcon className="h-3 w-3 mr-1.5 text-primary" />
            {date ? format(date, "d MMM yyyy") : label || placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelect}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal h-10 border-input bg-background hover:bg-background",
            !date && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 mr-2 text-primary" />
          {date ? format(date, "d MMM yyyy") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
