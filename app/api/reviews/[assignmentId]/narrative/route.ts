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

  const narrative = typeof body?.narrative === "string" ? body.narrative : "";
  const submit = body?.submit === true;

  // Load assignment (RLS should restrict this, but we validate too)
  const { data: ra, error: raErr } = await supabase
    .from("review_assignments")
    .select("id, cycle_id, employee_id, reviewer_id, reviewer_type, is_active")
    .eq("id", assignmentId)
    .single();

  if (raErr) return NextResponse.json({ error: raErr }, { status: 400 });
  if (!ra?.is_active) return NextResponse.json({ error: "Assignment is not active" }, { status: 400 });
  if (ra.reviewer_id !== auth.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const nextStatus = submit ? "submitted" : "draft";

  const upsertPayload: any = {
    assignment_id: assignmentId,
    cycle_id: ra.cycle_id,
    employee_id: ra.employee_id,
    reviewer_id: ra.reviewer_id,
    reviewer_type: ra.reviewer_type,
    status: nextStatus,
    summary_employee_visible: narrative,
    submitted_at: submit ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const { data: upserted, error: upErr } = await supabase
    .from("reviews")
    .upsert(upsertPayload, { onConflict: "assignment_id" })
    .select("id")
    .single();

  if (upErr) return NextResponse.json({ error: upErr }, { status: 400 });

  return NextResponse.json({ ok: true, review_id: upserted.id });
}
