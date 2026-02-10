import { createSupabaseServerClient } from "@/lib/supabaseServer";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asUuidOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  return UUID_RE.test(v) ? v : null;
}

export type CycleResolveResult = {
  selectedCycleId: string | null;
  cycleIdsToUse: string[];     // usually [selectedCycleId] if present
  cycleQS: string;             // "" or "?cycleId=..."
  cycleLabel: string;          // "Override cycle" | "Active cycle" | "Open cycle" | "No cycle"
  openCycleIds: string[];      // all open cycles
};

async function isAdminServer(userId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  // RLS on admin_users allows the row to be visible only if you are an admin (self-read)
  const { data, error } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (error) return false;
  return !!data?.id;
}

async function getOpenCycleIdsServer(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("review_cycles")
    .select("id, status, start_date")
    .in("status", ["draft", "calibrating"])
    .order("start_date", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((r: any) => r.id).filter(Boolean);
}

async function getGlobalActiveCycleIdServer(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "active_cycle_id")
    .maybeSingle();

  if (error) throw error;

  const raw = data?.value ?? null;
  return asUuidOrNull(raw);
}

/**
 * Precedence:
 *   1) Override: admin + ?cycleId=...
 *   2) Global active cycle: app_settings.active_cycle_id
 *   3) First open cycle (draft/calibrating)
 */
export async function resolveCycleServer(args: {
  userId: string | null;
  cycleIdFromQS?: string | null;
}): Promise<CycleResolveResult> {
  const openCycleIds = await getOpenCycleIdsServer();
  const openSet = new Set(openCycleIds);

  // If not logged in, treat as non-admin (and do NOT query admin_users with empty id)
  const isAdmin = args.userId ? await isAdminServer(args.userId) : false;

  const qsCycleId = asUuidOrNull(args.cycleIdFromQS ?? null);
  const globalActiveCycleId = await getGlobalActiveCycleIdServer();

  let selectedCycleId: string | null = null;
  let cycleLabel = "No cycle";
  let cycleQS = "";

  // 1) admin override (ONLY if cycle is open)
  if (isAdmin && qsCycleId && openSet.has(qsCycleId)) {
    selectedCycleId = qsCycleId;
    cycleLabel = "Override cycle";
    cycleQS = `?cycleId=${qsCycleId}`;
  }
  // 2) global active (ONLY if cycle is open)
  else if (globalActiveCycleId && openSet.has(globalActiveCycleId)) {
    selectedCycleId = globalActiveCycleId;
    cycleLabel = "Active cycle";
    cycleQS = "";
  }
  // 3) first open
  else if (openCycleIds.length > 0) {
    selectedCycleId = openCycleIds[0];
    cycleLabel = "Open cycle";
    cycleQS = "";
  }

  const cycleIdsToUse = selectedCycleId ? [selectedCycleId] : [];

  return {
    selectedCycleId,
    cycleIdsToUse,
    cycleQS,
    cycleLabel,
    openCycleIds,
  };
}

export async function getActiveCycleIdServer(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;

  const res = await resolveCycleServer({
    userId,
    cycleIdFromQS: null,
  });

  return res.selectedCycleId;
}
