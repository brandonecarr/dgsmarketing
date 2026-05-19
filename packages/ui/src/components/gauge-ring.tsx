import { cn } from "../lib/cn";

export interface GaugeRingProps {
  value: number;
  max?: number;
  label?: string;
  status?: "healthy" | "watch" | "critical" | "none";
  size?: number;
  className?: string;
}

const STATUS_COLOR: Record<NonNullable<GaugeRingProps["status"]>, string> = {
  healthy: "#3b82f6",
  watch: "#f59e0b",
  critical: "#ef4444",
  none: "#9ca3af",
};

export function GaugeRing({
  value,
  max = 100,
  label,
  status = "healthy",
  size = 80,
  className,
}: GaugeRingProps) {
  const pct = Math.max(0, Math.min(1, value / max));
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  const color = STATUS_COLOR[status];

  return (
    <div className={cn("relative inline-flex flex-col items-center", className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--border))" strokeWidth={6} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={6}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-xl font-bold leading-none">{value}</div>
        {label ? (
          <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            {label}
          </div>
        ) : null}
      </div>
    </div>
  );
}
