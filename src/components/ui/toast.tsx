import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X, CheckCircle2, AlertTriangle, Trash2, Info } from "lucide-react";

import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 md:max-w-[380px]",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-md border px-4 py-3 shadow-xl transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border-border/60 bg-[hsl(0_0%_7%)] text-foreground shadow-black/50",
        destructive: "border-destructive/30 bg-[hsl(0_20%_8%)] text-foreground shadow-black/50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return <ToastPrimitives.Root ref={ref} className={cn(toastVariants({ variant }), className)} {...props} />;
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-7 shrink-0 items-center justify-center rounded border border-border/50 bg-muted/30 px-3 text-[11px] font-medium text-foreground transition-colors hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-destructive/30 group-[.destructive]:hover:bg-destructive/20",
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded p-0.5 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground focus:opacity-100 focus:outline-none",
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="h-3.5 w-3.5" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title ref={ref} className={cn("text-[13px] font-medium text-foreground", className)} {...props} />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description ref={ref} className={cn("text-[12px] text-muted-foreground", className)} {...props} />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

// Icon helper for the toaster
function ToastIcon({ title, variant }: { title?: string; variant?: string }) {
  if (variant === "destructive") {
    return <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />;
  }
  const t = (title || "").toLowerCase();
  if (t.includes("delete") || t.includes("removed")) {
    return <Trash2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />;
  }
  if (t.includes("complete") || t.includes("added") || t.includes("created") || t.includes("recorded") || t.includes("updated") || t.includes("saved") || t.includes("imported") || t.includes("geocoded") || t.includes("optimised") || t.includes("logged") || t.includes("exported") || t.includes("sent")) {
    return <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />;
  }
  if (t.includes("cancel")) {
    return <X className="h-4 w-4 text-warning shrink-0 mt-0.5" />;
  }
  return <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />;
}

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;

type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  ToastIcon,
};
