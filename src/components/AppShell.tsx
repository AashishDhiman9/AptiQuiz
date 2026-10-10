import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Home, LayoutDashboard, Dumbbell, Swords, Radio, Library, Trophy, LineChart, School, Tv, User, Zap, LogIn, LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { clearPendingRole } from "@/lib/role-selection";
import { toast } from "sonner";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/practice", label: "Practice", icon: Dumbbell },
  { to: "/play", label: "Battle Arena", icon: Swords },
  { to: "/host", label: "Host Dashboard", icon: Radio },
  { to: "/sets", label: "Question Sets", icon: Library },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/performance", label: "My Performance", icon: LineChart },
  { to: "/leagues", label: "College Leagues", icon: School },
  { to: "/spectate", label: "Spectator Mode", icon: Tv },
  { to: "/profile", label: "Profile", icon: User },
] as const;

const MOBILE = ["/", "/play", "/leaderboard", "/performance", "/profile"];

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold">
      <Zap className="size-6 fill-primary text-primary" />
      <span>Apti<span className="text-primary">Quiz</span></span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, profile } = useAuth();
  const nav = useNavigate();
  if (path.startsWith("/spectate/")) return <>{children}</>;
  const isActive = (to: string) => (to === "/" ? path === "/" : path.startsWith(to));
  const visibleNav = NAV.filter(({ to }) => {
    if (to === "/host" || to === "/sets") return profile?.role === "host";
    if (to === "/dashboard" || to === "/performance" || to === "/profile") return !!user;
    return true;
  });

  async function signOut() {
    clearPendingRole();
    const { error } = await supabase.auth.signOut();
    if (error) return toast.error(error.message);
    nav({ to: "/" });
  }

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar backdrop-blur-xl lg:flex">
        <div className="px-6 py-6"><Logo /></div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="Main">
          {visibleNav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                isActive(to) && "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_var(--primary)]",
              )}
            >
              <Icon className="size-4" /> {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-full bg-surface-2 text-sm font-semibold text-primary">
                {(user.email ?? "?")[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{user.email}</div>
              <button aria-label="Sign out" onClick={signOut} className="text-muted-foreground hover:text-foreground">
                <LogOut className="size-4" />
              </button>
            </div>
          ) : (
            <Link to="/auth" className="flex items-center gap-2 text-sm text-primary"><LogIn className="size-4" /> Sign in</Link>
          )}
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Logo />
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-lg border border-border px-3 py-1.5 text-sm">Menu</summary>
          <div className="glass absolute right-0 mt-2 w-56 p-2">
            {visibleNav.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm", isActive(to) ? "text-primary" : "text-muted-foreground")}>
                <Icon className="size-4" /> {label}
              </Link>
            ))}
            {user ? (
              <button onClick={signOut} className="flex w-full items-center gap-3 px-3 py-2 text-sm text-muted-foreground"><LogOut className="size-4" /> Sign out</button>
            ) : (
              <Link to="/auth" className="flex items-center gap-3 px-3 py-2 text-sm text-primary"><LogIn className="size-4" /> Sign in</Link>
            )}
          </div>
        </details>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-background/90 backdrop-blur-xl lg:hidden" aria-label="Quick">
        {visibleNav.filter((n) => MOBILE.includes(n.to)).map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className={cn("flex flex-col items-center gap-1 py-2 text-[10px]", isActive(to) ? "text-primary" : "text-muted-foreground")}>
            <Icon className="size-5" /> {label.split(" ")[0]}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Stat({ label, value, icon: Icon, hint }: { label: string; value: ReactNode; icon?: React.ComponentType<{ className?: string }>; hint?: string }) {
  return (
    <div className="glass flex items-center gap-4 p-4">
      {Icon && <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></div>}
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="tabular font-display text-2xl font-bold">{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
}

export function DemoBadge() {
  return <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warning">Demo data</span>;
}

export function Initials({ name, className }: { name: string; className?: string }) {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 4;
  const tone = ["bg-primary/15 text-primary", "bg-blue/20 text-blue", "bg-violet/20 text-violet", "bg-success/15 text-success"][hue];
  return <div className={cn("grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold", tone, className)} aria-hidden>{name.slice(0, 2).toUpperCase()}</div>;
}
