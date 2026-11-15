import { cn } from "@/lib/utils";

/** Recuadro rojo con degradado y brillo, como los iconos del diseño. */
export function KpiIcon({ icon: Icon, bare, className }: { icon: React.ElementType; bare?: boolean; className?: string }) {
  if (bare) return <Icon className={cn("size-14 shrink-0 text-primary drop-shadow-[0_4px_6px_rgba(200,16,40,0.35)]", className)} strokeWidth={2.4} />;
  return (
    <span
      className={cn(
        "relative flex size-[60px] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b from-[#ff3b4a] via-[#e0101f] to-[#9d0713] text-white shadow-[0_8px_14px_-4px_rgba(200,16,40,0.55),inset_0_1px_0_rgba(255,255,255,0.45)]",
        className,
      )}
    >
      <span aria-hidden className="absolute inset-x-2 top-1 h-3 rounded-full bg-white/25 blur-[2px]" />
      <Icon className="relative size-8" strokeWidth={1.8} />
    </span>
  );
}
