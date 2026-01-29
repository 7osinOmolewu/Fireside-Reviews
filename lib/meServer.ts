import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function getMyRoleServer() {
  const supabase = await createSupabaseServerClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;

  const user = userData.user;
  if (!user) return null;

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("user_role, full_name")
    .eq("id", user.id)
    .single();

  if (profileErr) throw profileErr;

  return {
    userId: user.id,
    email: user.email ?? null,
    fullName: profile.full_name,
    role: profile.user_role as "admin" | "reviewer" | "employee",
  };
}