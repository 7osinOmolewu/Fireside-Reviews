import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function getJobRoles() {
  const { data, error } = await supabaseAdmin
    .from("job_roles")
    .select("code, name")
    .order("name");

  if (error) throw error;
  return data ?? [];
}
