import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ensureProfile } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { next: location.href } });
    }

    const hostOnly = location.pathname.startsWith("/host") || location.pathname.startsWith("/sets");
    if (hostOnly) {
      let profile;
      try {
        profile = await ensureProfile(data.user);
      } catch {
        throw redirect({ to: "/profile" });
      }
      if (profile.role !== "host") throw redirect({ href: "/dashboard?access=host" });
    }
  },
  component: () => <Outlet />,
});
