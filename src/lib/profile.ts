import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type HostRequest = Database["public"]["Tables"]["host_requests"]["Row"];

function suggestedDisplayName(user: User): string {
  const metadata = user.user_metadata as Record<string, unknown>;
  const fromMetadata = metadata.display_name ?? metadata.full_name;
  const candidate =
    (typeof fromMetadata === "string" && fromMetadata) || user.email?.split("@")[0] || "Player";
  const name = candidate.trim().slice(0, 24);
  return name.length >= 2 ? name : "Player";
}

export async function ensureProfile(user: User): Promise<Profile> {
  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("id, display_name, college_id, created_at, role")
    .eq("id", user.id)
    .maybeSingle();

  if (readError) {
    throw new Error(`Could not load your profile. ${readError.message}`);
  }
  if (existing) return existing;

  const { error: insertError } = await supabase
    .from("profiles")
    .insert({ id: user.id, display_name: suggestedDisplayName(user) });
  if (insertError && insertError.code !== "23505") {
    throw new Error(`Could not create your profile. ${insertError.message}`);
  }

  const { data: created, error: reloadError } = await supabase
    .from("profiles")
    .select("id, display_name, college_id, created_at, role")
    .eq("id", user.id)
    .maybeSingle();

  if (reloadError) {
    throw new Error(`Could not reload your profile. ${reloadError.message}`);
  }
  if (!created) {
    throw new Error("Your profile could not be created. Please try again.");
  }
  return created;
}

export async function getHostRequest(userId: string): Promise<HostRequest | null> {
  const { data, error } = await supabase
    .from("host_requests")
    .select("user_id, status, requested_at, reviewed_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function requestHostAccess(userId: string): Promise<HostRequest> {
  const existing = await getHostRequest(userId);
  if (existing) return existing;

  const { error: insertError } = await supabase.from("host_requests").insert({ user_id: userId });
  if (insertError && insertError.code !== "23505") {
    throw new Error(`Could not submit your Host request. ${insertError.message}`);
  }

  const request = await getHostRequest(userId);
  if (!request) throw new Error("Your Host request could not be loaded. Please try again.");
  return request;
}
