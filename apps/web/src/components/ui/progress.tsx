import { cn } from "@/lib/utils";

export function Progress({ value, className, danger }: { value: number; className?: string; danger?: boolean }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-2 w-full min-w-[80px] overflow-hidden rounded-sm bg-muted", className)}
    >
      <div className={cn("h-full", "bg-primary")} style={{ width: `${v}%` }} />
    </div>
  );
}
