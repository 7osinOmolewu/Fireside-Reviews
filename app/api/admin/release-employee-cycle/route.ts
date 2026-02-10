// app/api/admin/release-employee-cycle/route.ts
import { requireAdmin } from "@/lib/requireAdmin";
import { NextResponse } from "next/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  // If your requireAdmin takes 0 args (your error says it does), call it with 0 args.
  const { supabase, userId } = await requireAdmin();
  
  const body = await req.json().catch(() => null);
  const cycleId = body?.cycleId as string | undefined;
  const employeeId = body?.employeeId as string | undefined;

  if (!cycleId || !employeeId || !UUID_RE.test(cycleId) || !UUID_RE.test(employeeId)) {
    return NextResponse.json({ error: "Invalid cycleId/employeeId" }, { status: 400 });
  }

  const { error: rpcError } = await (supabase as any).rpc("admin_release_employee_cycle", {
    p_cycle_id: cycleId,
    p_employee_id: employeeId,
  });

  if (rpcError) {
    return NextResponse.json(
      { error: rpcError.message, code: rpcError.code },
      { status: 400 }
    );
  }

  const { data, error: readError } = await supabase
    .from("cycle_employee_summary_public")
    .select("cycle_id, employee_id, released_at, released_by, performance_rating_value")
    .eq("cycle_id", cycleId)
    .eq("employee_id", employeeId)
    .maybeSingle();

  if (readError) {
    return NextResponse.json(
      { error: readError.message, code: readError.code },
      { status: 400 }
    );
  }

  return NextResponse.json({ summary: data ?? null });
}
