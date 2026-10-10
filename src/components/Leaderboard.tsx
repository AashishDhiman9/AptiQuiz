import { ArrowDown, ArrowUp, Crown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Initials } from "./AppShell";
import { accuracy } from "@/lib/scoring";

export interface LbRow {
  id: string;
  display_name: string;
  score: number;
  rank?: number | null;
  prev_rank?: number | null;
  correct_count?: number;
  answered_count?: number;
  college?: string | null;
}

const medal = ["text-gold", "text-silver", "text-bronze"];

export function Leaderboard({ rows, meId, size = "md", showAccuracy }: { rows: LbRow[]; meId?: string | null; size?: "sm" | "md" | "xl"; showAccuracy?: boolean }) {
  if (!rows.length) return <p className="p-6 text-center text-sm text-muted-foreground">No players yet.</p>;
  return (
    <ol className="space-y-1.5" aria-label="Leaderboard">
      {rows.map((r, i) => {
        const rank = r.rank ?? i + 1;
        const move = r.prev_rank && r.rank ? r.prev_rank - r.rank : 0;
        const me = r.id === meId;
        return (
          <li
            key={`${r.id}-${rank}`}
            className={cn(
              "flex items-center gap-3 rounded-xl border border-transparent px-3 transition-colors",
              size === "xl" ? "py-4 text-2xl" : size === "sm" ? "py-1.5 text-sm" : "py-2.5",
              me ? "border-primary/60 bg-primary/12 glow-ring" : "bg-surface/50",
              move > 0 && "animate-rank-up",
              move < 0 && "animate-rank-down",
            )}
          >
            <span className={cn("tabular w-8 text-center font-display font-bold", rank <= 3 ? medal[rank - 1] : "text-muted-foreground")}>
              {rank === 1 ? <Crown className={cn("mx-auto", size === "xl" ? "size-7" : "size-4")} /> : rank}
            </span>
            <Initials name={r.display_name} className={size === "xl" ? "size-12 text-base" : size === "sm" ? "size-7" : undefined} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{r.display_name}{me && <span className="ml-2 text-xs text-primary">(you)</span>}</div>
              {(r.college || showAccuracy) && (
                <div className={cn("truncate text-muted-foreground", size === "xl" ? "text-base" : "text-[11px]")}>
                  {r.college}
                  {showAccuracy && r.answered_count != null && ` · ${accuracy(r.correct_count ?? 0, r.answered_count)}% acc`}
                </div>
              )}
            </div>
            <span className={cn("tabular font-display font-bold", size === "xl" && "text-3xl")}>{r.score.toLocaleString()}</span>
            <span className="w-8 text-right text-xs" aria-label={move ? `moved ${move > 0 ? "up" : "down"} ${Math.abs(move)}` : "no change"}>
              {move > 0 ? (
                <span className="inline-flex items-center text-success"><ArrowUp className="size-3" />{move}</span>
              ) : move < 0 ? (
                <span className="inline-flex items-center text-destructive"><ArrowDown className="size-3" />{-move}</span>
              ) : (
                <Minus className="ml-auto size-3 text-muted-foreground/50" />
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
