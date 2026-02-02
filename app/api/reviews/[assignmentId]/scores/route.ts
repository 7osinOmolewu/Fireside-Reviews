import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ assignmentId: string }> }
) {
  const { assignmentId } = await ctx.params;
  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const category_scores =
    body?.category_scores && typeof body.category_scores === "object"
      ? body.category_scores
      : null;

  if (!category_scores) {
    return NextResponse.json({ error: "category_scores must be an object" }, { status: 400 });
  }

  // Validate assignment + primary reviewer (source of truth)
  const { data: ra, error: raErr } = await supabase
    .from("review_assignments")
    .select("id, cycle_id, employee_id, reviewer_id, reviewer_type, is_active")
    .eq("id", assignmentId)
    .single();

  if (raErr) return NextResponse.json({ error: raErr }, { status: 400 });
  if (!ra?.is_active)
    return NextResponse.json({ error: "Assignment is not active" }, { status: 400 });
  if (ra.reviewer_id !== auth.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (ra.reviewer_type !== "primary")
    return NextResponse.json({ error: "Only primary can score" }, { status: 403 });

  // ✅ Ensure a review row exists (single row per assignment)
  const { data: reviewRow, error: reviewUpsertErr } = await supabase
    .from("reviews")
    .upsert(
      {
        assignment_id: assignmentId,
        cycle_id: ra.cycle_id,
        employee_id: ra.employee_id,
        reviewer_id: ra.reviewer_id,
        reviewer_type: ra.reviewer_type,
      
        updated_at: new Date().toISOString(),
      },
      { onConflict: "assignment_id" }
    )
    .select("id, reviewer_id, reviewer_type, status")
    .single();

  if (reviewUpsertErr) return NextResponse.json({ error: reviewUpsertErr }, { status: 400 });

  // If already submitted, block scoring edits (optional but matches your intent)
  if (reviewRow.status === "submitted") {
    return NextResponse.json({ error: "Review is submitted and locked" }, { status: 400 });
  }

  const { error: upErr } = await supabase
    .from("review_scores")
    .upsert(
      {
        review_id: reviewRow.id,
        category_scores,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "review_id" }
    );

  if (upErr) return NextResponse.json({ error: upErr }, { status: 400 });

  return NextResponse.json({ ok: true });
}
