import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  try {
    const { supabase, userId } = await requireAdmin();

    const body = await req.json().catch(() => null);

    const cycleId = typeof body?.cycleId === "string" ? body.cycleId : "";
    const employeeId = typeof body?.employeeId === "string" ? body.employeeId : "";
    const finalNarrative =
      typeof body?.finalNarrative === "string" ? body.finalNarrative.trim() : "";
    const calibrationAdjustmentRaw = body?.calibrationAdjustment;
    const calibrationReason =
      typeof body?.calibrationReason === "string" ? body.calibrationReason.trim() : "";

    if (!UUID_RE.test(cycleId) || !UUID_RE.test(employeeId)) {
      return NextResponse.json(
        { error: "Invalid cycleId or employeeId." },
        { status: 400 }
      );
    }

    if (!finalNarrative) {
      return NextResponse.json(
        { error: "Final narrative is required before finalizing." },
        { status: 400 }
      );
    }

    const calibrationAdjustment =
      typeof calibrationAdjustmentRaw === "number"
        ? calibrationAdjustmentRaw
        : Number(calibrationAdjustmentRaw ?? 0);

    if (!Number.isInteger(calibrationAdjustment)) {
      return NextResponse.json(
        { error: "Calibration adjustment must be an integer." },
        { status: 400 }
      );
    }

    const { error: rpcError } = await (supabase as any).rpc(
      "finalize_employee_cycle_summary",
      {
        p_cycle_id: cycleId,
        p_employee_id: employeeId,
        p_final_narrative: finalNarrative,
        p_calibration_adjustment: calibrationAdjustment,
        p_calibration_reason: calibrationReason || null,
        p_computed_by: userId,
      }
    );

    if (rpcError) {
      console.error("finalize_employee_cycle_summary rpcError", rpcError);
      return NextResponse.json(
        { error: rpcError.message, code: rpcError.code ?? null },
        { status: 400 }
      );
    }

    const [
      { data: internalSummary, error: internalError },
      { data: publicSummary, error: publicError },
    ] = await Promise.all([
      supabase
        .from("cycle_employee_summary")
        .select(
          `
          cycle_id,
          employee_id,
          primary_review_id,
          primary_final_score,
          performance_rating,
          final_narrative_employee_visible,
          calibration_reason,
          finalized_at,
          computed_at
        `
        )
        .eq("cycle_id", cycleId)
        .eq("employee_id", employeeId)
        .maybeSingle(),

      supabase
        .from("cycle_employee_summary_public")
        .select(
          `
          cycle_id,
          employee_id,
          performance_rating,
          performance_rating_value,
          final_narrative_employee_visible,
          finalized_at,
          released_at,
          released_by
        `
        )
        .eq("cycle_id", cycleId)
        .eq("employee_id", employeeId)
        .maybeSingle(),
    ]);

    if (internalError || publicError) {
      return NextResponse.json(
        {
          error:
            internalError?.message ??
            publicError?.message ??
            "Finalize succeeded but read-back failed.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      internalSummary,
      publicSummary,
    });
  } catch (e: any) {
    console.error("finalize-employee-cycle route error", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}