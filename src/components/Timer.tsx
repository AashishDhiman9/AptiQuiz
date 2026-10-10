import { cn } from "@/lib/utils";

export function TimerRing({ remainingMs, totalMs, size = 96 }: { remainingMs: number; totalMs: number; size?: number }) {
  const pct = totalMs > 0 ? remainingMs / totalMs : 0;
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const secs = Math.ceil(remainingMs / 1000);
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} role="timer" aria-label={`${secs} seconds left`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-2)" strokeWidth="6" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={pct < 0.25 ? "var(--destructive)" : "var(--primary)"}
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 200ms linear" }}
        />
      </svg>
      <span className={cn("tabular absolute font-display font-bold", size > 120 ? "text-5xl" : "text-2xl", pct < 0.25 && "text-destructive")}>{secs}s</span>
    </div>
  );
}
