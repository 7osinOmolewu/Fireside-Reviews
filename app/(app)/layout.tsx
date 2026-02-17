import { AppShell } from "../_components/app-shell";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

type RoleLabel = "Admin" | "Reviewer" | "Employee";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userName: string | null = null;
  let roleLabel: RoleLabel = "Employee";
  let isAdmin = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    userName = profile?.full_name ?? profile?.email ?? null;

    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    isAdmin = Boolean(adminRow?.id);

    if (isAdmin) {
      roleLabel = "Admin";
    } else {
      // "Reviewer" means they have at least 1 active assignment to complete
      const { count } = await supabase
        .from("review_assignments")
        .select("id", { count: "exact", head: true })
        .eq("reviewer_id", user.id)
        .eq("is_active", true);

      roleLabel = (count ?? 0) > 0 ? "Reviewer" : "Employee";
    }
  }

  return (
    <AppShell
      isAuthenticated={!!user}
      userName={userName}
      roleLabel={roleLabel}
      isAdmin={isAdmin}
    >
      {children}
    </AppShell>
  );
}
