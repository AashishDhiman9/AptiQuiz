import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ensureProfile, type Profile } from "@/lib/profile";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ?? null);
    });

    supabase.auth
      .getSession()
      .then(({ data: sessionData, error }) => {
        if (!active) return;
        if (error) setProfileError(error.message);
        setUser(sessionData.session?.user ?? null);
      })
      .catch((error: unknown) => {
        if (active)
          setProfileError(error instanceof Error ? error.message : "Could not load session");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      setProfileError(null);
      return;
    }

    setProfile(null);
    setProfileLoading(true);
    setProfileError(null);
    ensureProfile(user)
      .then((nextProfile) => {
        if (active) setProfile(nextProfile);
      })
      .catch((error: unknown) => {
        if (active) {
          setProfileError(error instanceof Error ? error.message : "Could not load your profile");
        }
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  return { user, loading, profile, profileLoading, profileError };
}
