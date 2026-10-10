import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/play/")({
  head: () => ({
    meta: [
      { title: "Battle Arena — Join a Competition | AptiQuiz" },
      { name: "description", content: "Enter a room code to join a live aptitude competition from your phone or laptop." },
      { property: "og:title", content: "Join a live AptiQuiz battle" },
      { property: "og:description", content: "Enter your room code and compete in real time." },
    ],
  }),
  component: PlayEntry,
});

function PlayEntry() {
  const [code, setCode] = useState("");
  const nav = useNavigate();
  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Battle Arena" subtitle="Enter the code shown by your host." />
      <form
        className="glass space-y-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          const c = code.trim().toUpperCase();
          if (c.length >= 4) nav({ to: "/play/$code", params: { code: c } });
        }}
      >
        <Swords className="size-8 text-primary" />
        <Input aria-label="Room code" autoFocus value={code} maxLength={8} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="A7KQ3X" className="h-14 text-center font-display text-3xl tracking-[0.35em] uppercase" />
        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={code.trim().length < 4}>Join room</Button>
        <p className="text-center text-sm text-muted-foreground">No code? <Link to="/practice" className="text-primary">Practice solo</Link> or <Link to="/host" className="text-primary">host your own</Link>.</p>
      </form>
    </div>
  );
}
