import { MAX_SPEED_BONUS, BASE_POINTS, NETWORK_GRACE_MS } from "@/lib/scoring";

export function RulesCard({ compact }: { compact?: boolean }) {
  return (
    <div className="glass p-4 text-sm">
      <h3 className="mb-2 font-semibold">Scoring rules</h3>
      <ul className="space-y-1 text-muted-foreground">
        <li>Correct: <b className="text-foreground">{BASE_POINTS.toLocaleString()}</b> + speed bonus up to <b className="text-foreground">{MAX_SPEED_BONUS}</b></li>
        <li>Bonus = 500 × (1 − time used ÷ time limit), timed by the server</li>
        <li>Wrong, late or unanswered: 0</li>
        {!compact && <li>One answer per question. Answers up to {NETWORK_GRACE_MS} ms after the deadline are allowed for network delay.</li>}
        {!compact && <li>Ties: more correct answers, then less total answer time.</li>}
      </ul>
    </div>
  );
}
