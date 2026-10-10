import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { RoleChoices } from "@/components/RoleChoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/AppShell";
import { ensureProfile } from "@/lib/profile";
import {
  clearPendingRole,
  getPendingRole,
  setPendingRole,
  type AppRole,
} from "@/lib/role-selection";

const safeNext = (path?: string) =>
  path && path.startsWith("/") && !path.startsWith("//") && !path.includes("\\")
    ? path
    : "/dashboard";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({
    next: z.string().optional(),
    error: z.string().optional(),
    error_description: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Sign in — AptiQuiz" },
      {
        name: "description",
        content: "Sign in to track your performance, host quizzes and represent your college.",
      },
      { property: "og:title", content: "Sign in — AptiQuiz" },
      { property: "og:description", content: "Sign in to AptiQuiz." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { next, error, error_description } = Route.useSearch();
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [role, setRole] = useState<AppRole | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const finishing = useRef(false);
  const dest = safeNext(next);

  const finishLogin = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    setBusy(true);
    try {
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!data.user) return;
      const profile = await ensureProfile(data.user);
      const intendedRole = getPendingRole();
      clearPendingRole();
      if (intendedRole === "host") {
        nav({ href: profile.role === "host" ? "/host" : "/dashboard?access=host" });
      } else if (intendedRole === "player") {
        nav({ to: "/dashboard" });
      } else {
        nav({ href: dest });
      }
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not finish signing in");
    } finally {
      finishing.current = false;
      setBusy(false);
    }
  }, [dest, nav]);

  useEffect(() => {
    setRole(getPendingRole());
    setReady(true);
    const callbackParams = new URLSearchParams(window.location.hash.slice(1));
    const callbackError = callbackParams.get("error_description") ?? callbackParams.get("error");
    if (error || error_description || callbackError) {
      toast.error(error_description ?? callbackError ?? error ?? "Authentication was cancelled");
      clearPendingRole();
      setRole(null);
      if (callbackError) {
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname + window.location.search,
        );
      }
    }
  }, [error, error_description]);

  useEffect(() => {
    if (!ready) return;
    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (sessionError) throw sessionError;
        if (data.session) void finishLogin();
      })
      .catch((cause: unknown) => {
        toast.error(cause instanceof Error ? cause.message : "Could not restore your session");
      });
  }, [finishLogin, ready]);

  function chooseRole(nextRole: AppRole) {
    setPendingRole(nextRole);
    setRole(nextRole);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        await finishLogin();
      } else {
        const callbackPath = role === "host" ? "/host" : role === "player" ? "/dashboard" : dest;
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth?next=${encodeURIComponent(callbackPath)}`,
            data: { display_name: name },
          },
        });
        if (signUpError) throw signUpError;
        if (data.session) await finishLogin();
        else
          toast.success(
            "Check your email to confirm your account. Your role choice will be kept briefly on this device.",
          );
      }
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    try {
      const callbackPath = role === "host" ? "/host" : role === "player" ? "/dashboard" : dest;
      const callback = `${window.location.origin}/auth?next=${encodeURIComponent(callbackPath)}`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callback },
      });
      if (oauthError) throw oauthError;
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not start Google sign in");
      setBusy(false);
    }
  }

  if (!ready)
    return <div className="mx-auto mt-6 max-w-sm animate-pulse rounded-2xl bg-surface/60 p-10" />;

  return (
    <div className="mx-auto mt-6 max-w-xl">
      <div className="glass p-6 sm:p-8">
        <Logo />
        {!role && !next ? (
          <>
            <h1 className="mt-5 text-2xl font-bold">How will you use AptiQuiz?</h1>
            <p className="mb-5 mt-1 text-sm text-muted-foreground">
              Choose a role to continue to secure sign in.
            </p>
            <RoleChoices onSelect={chooseRole} />
          </>
        ) : (
          <>
            <h1 className="mt-5 text-2xl font-bold">
              {mode === "in" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {role === "host"
                ? "Host access requires approval. You can request it after signing in."
                : "Join timed competitions, track your results, or continue as a guest with a room code."}
            </p>
            {role && (
              <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-primary">
                Continuing as {role}
              </p>
            )}
            <Button variant="glass" className="mt-5 w-full" onClick={google} disabled={busy}>
              Continue with Google
            </Button>
            <div className="my-4 text-center text-xs text-muted-foreground">or</div>
            <form onSubmit={submit} className="space-y-3">
              {mode === "up" && (
                <div>
                  <Label htmlFor="n">Display name</Label>
                  <Input
                    id="n"
                    required
                    minLength={2}
                    maxLength={24}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}
              <div>
                <Label htmlFor="e">Email</Label>
                <Input
                  id="e"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="p">Password</Label>
                <Input
                  id="p"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" variant="hero" className="w-full" disabled={busy}>
                {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Sign up"}
              </Button>
            </form>
            <button
              className="mt-4 w-full text-center text-sm text-primary"
              onClick={() => setMode(mode === "in" ? "up" : "in")}
            >
              {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
            </button>
            {!next && (
              <button
                className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  clearPendingRole();
                  setRole(null);
                }}
              >
                Choose a different role
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
