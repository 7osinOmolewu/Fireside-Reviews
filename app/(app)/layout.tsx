import { AppShell } from "../_components/app-shell";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userName: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    userName = profile?.full_name ?? profile?.email ?? null;
  }

  return (
    <AppShell isAuthenticated={!!user} userName={userName}>
      {children}
    </AppShell>
  );
}
