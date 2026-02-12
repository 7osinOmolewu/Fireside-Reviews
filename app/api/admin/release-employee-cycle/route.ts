import { requireAdmin } from "@/lib/requireAdmin";
import { NextResponse } from "next/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  try {
    const { supabase } = await requireAdmin();

    const body = await req.json().catch(() => null);
    const cycleId = typeof body?.cycleId === "string" ? body.cycleId : undefined;
    const employeeId = typeof body?.employeeId === "string" ? body.employeeId : undefined;

    if (!cycleId || !employeeId || !UUID_RE.test(cycleId) || !UUID_RE.test(employeeId)) {
      return NextResponse.json({ error: "Invalid cycleId/employeeId" }, { status: 400 });
    }

    const { error: rpcError } = await supabase.rpc("admin_release_employee_cycle", {
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
        { status: 500 }
      );
    }

    return NextResponse.json({ summary: data ?? null });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}
