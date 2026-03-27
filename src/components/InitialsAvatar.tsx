import { cn } from "@/lib/utils";

interface InitialsAvatarProps {
  name: string;
  size?: "sm" | "lg";
}

export default function InitialsAvatar({ name, size = "sm" }: InitialsAvatarProps) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const hue = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  const dim = size === "lg" ? "h-11 w-11 text-[13px]" : "h-8 w-8 text-[11px]";
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-full font-medium", dim)}
      style={{ backgroundColor: `hsl(${hue} 30% 18%)`, color: `hsl(${hue} 60% 65%)` }}
    >
      {initials || "?"}
    </div>
  );
}
