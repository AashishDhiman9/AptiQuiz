import { ArrowRight, Radio, Swords } from "lucide-react";
import type { AppRole } from "@/lib/role-selection";

const choices: {
  role: AppRole;
  label: string;
  description: string;
  action: string;
  icon: typeof Radio;
}[] = [
  {
    role: "host",
    label: "HOST",
    description: "Build question sets, run rooms, and review match results.",
    action: "Continue as Host",
    icon: Radio,
  },
  {
    role: "player",
    label: "PLAYER",
    description: "Join timed competitions, track your results, and climb the leaderboard.",
    action: "Continue as Player",
    icon: Swords,
  },
];

export function RoleChoices({ onSelect }: { onSelect: (role: AppRole) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" aria-label="Choose how to use AptiQuiz">
      {choices.map(({ role, label, description, action, icon: Icon }) => (
        <button
          key={role}
          type="button"
          onClick={() => onSelect(role)}
          className="glass group flex min-h-36 flex-col items-start rounded-2xl border border-border p-5 text-left transition hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={action}
        >
          <span className="flex w-full items-center justify-between">
            <span className="flex items-center gap-2 font-display text-sm font-bold tracking-widest text-primary">
              <Icon className="size-4" /> {label}
            </span>
            <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
          </span>
          <span className="mt-3 text-sm text-muted-foreground">{description}</span>
          <span className="mt-auto pt-4 text-sm font-semibold">{action}</span>
        </button>
      ))}
    </div>
  );
}
