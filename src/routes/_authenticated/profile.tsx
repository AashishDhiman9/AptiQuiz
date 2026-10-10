import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Initials } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { collegesQuery } from "@/lib/data";

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
  const { user } = useAuth();
  const colleges = useQuery(collegesQuery);
  const prof = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });
  const [name, setName] = useState("");
  const [college, setCollege] = useState("");
  useEffect(() => {
    if (prof.data) { setName(prof.data.display_name); setCollege(prof.data.college_id ?? ""); }
  }, [prof.data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (name.trim().length < 2) return toast.error("Name too short");
    const { error } = await supabase.from("profiles").upsert({ id: user.id, display_name: name.trim().slice(0, 24), college_id: college || null });
    if (error) return toast.error(error.message);
    await supabase.auth.updateUser({ data: { display_name: name.trim() } });
    toast.success("Profile saved");
  }

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Profile" />
      <form onSubmit={save} className="glass space-y-4 p-6">
        <div className="flex items-center gap-4"><Initials name={name || "?"} className="size-14 text-lg" /><div><div className="font-semibold">{name}</div><div className="text-sm text-muted-foreground">{user?.email}</div></div></div>
        <div><Label htmlFor="nm">Display name</Label><Input id="nm" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div>
          <Label htmlFor="cl">College</Label>
          <select id="cl" className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm" value={college} onChange={(e) => setCollege(e.target.value)}>
            <option value="">— None —</option>
            {colleges.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">Used as the default when you join a room.</p>
        </div>
        <Button type="submit" variant="hero">Save</Button>
      </form>
    </div>
  );
}
