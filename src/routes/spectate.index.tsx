import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/spectate/")({
  head: () => ({
    meta: [
      { title: "Spectator Mode — AptiQuiz" },
      {
        name: "description",
        content: "Full-screen, read-only live standings for projectors and auditoriums.",
      },
      { property: "og:title", content: "AptiQuiz Spectator Mode" },
      {
        property: "og:description",
        content: "Project live competition standings on the big screen.",
      },
    ],
  }),
  component: SpectatorIndex,
});

function SpectatorIndex() {
  const [code, setCode] = useState("");
  const nav = useNavigate();
  return (
    <div className="mx-auto max-w-md">
      <PageHeader
        title="Spectator Mode"
        subtitle="Read-only big-screen view. Spectators can't answer or control the game."
      />
      <form
        className="glass space-y-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length >= 4) nav({ to: "/spectate/$code", params: { code } });
        }}
      >
        <Tv className="size-8 text-primary" />
        <Input
          aria-label="Room code"
          value={code}
          maxLength={8}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Room code"
          className="h-14 text-center font-display text-3xl tracking-[0.35em]"
        />
        <Button type="submit" variant="hero" className="w-full">
          Open display
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => nav({ to: "/spectate/$code", params: { code: "DEMO01" } })}
        >
          View demo match
        </Button>
      </form>
    </div>
  );
}
