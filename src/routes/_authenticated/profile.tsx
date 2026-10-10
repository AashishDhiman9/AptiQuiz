import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Initials, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { collegesQuery } from "@/lib/data";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — AptiQuiz" },
      { name: "description", content: "Manage your display name and college affiliation." },
      { property: "og:title", content: "Profile — AptiQuiz" },
      { property: "og:description", content: "Your AptiQuiz profile." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { user, profile, profileLoading, profileError } = useAuth();
  const colleges = useQuery(collegesQuery);
  const [name, setName] = useState("");
  const [college, setCollege] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.display_name);
      setCollege(profile.college_id ?? "");
    }
  }, [profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (name.trim().length < 2) return toast.error("Name must have at least 2 characters");
    setSaving(true);
    try {
      const displayName = name.trim().slice(0, 24);
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName, college_id: college || null })
        .eq("id", user.id);
      if (error) throw error;
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { display_name: displayName },
      });
      if (metadataError) throw metadataError;
      toast.success("Profile saved");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not save your profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Profile" />
      {profileLoading ? (
        <div className="glass animate-pulse p-8 text-sm text-muted-foreground">Loading your profile…</div>
      ) : profileError || !profile ? (
        <div className="glass space-y-3 p-6" role="alert">
          <h2 className="font-semibold">Your profile is unavailable</h2>
          <p className="text-sm text-muted-foreground">{profileError ?? "We could not find your profile."}</p>
          <p className="text-sm text-muted-foreground">Check that the Supabase migrations are applied, then try again.</p>
          <Button type="button" variant="glass" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      ) : (
        <form onSubmit={save} className="glass space-y-4 p-6">
          <div className="flex items-center gap-4">
            <Initials name={name || "?"} className="size-14 text-lg" />
            <div>
              <div className="font-semibold">{name}</div>
              <div className="text-sm text-muted-foreground">{user?.email}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-primary">{profile.role} account</div>
            </div>
          </div>
          <div>
            <Label htmlFor="nm">Display name</Label>
            <Input id="nm" maxLength={24} minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cl">College</Label>
            <select id="cl" className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm" value={college} onChange={(e) => setCollege(e.target.value)}>
              <option value="">— None —</option>
              {colleges.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">Used as the default when you join a room.</p>
          </div>
          <Button type="submit" variant="hero" disabled={saving}>{saving ? "Saving…" : "Save profile"}</Button>
        </form>
      )}
    </div>
  );
}
