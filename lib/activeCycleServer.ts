import { createSupabaseServerClient } from "@/lib/supabaseServer";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getActiveCycleIdServer(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await (supabase as any)
    .from("app_settings")
    .select("value")
    .eq("key", "active_cycle_id")
    .maybeSingle();

  if (error) throw error;

  const raw = data?.value ?? null;
  if (!raw) return null;

  return UUID_RE.test(raw) ? raw : null;
}
