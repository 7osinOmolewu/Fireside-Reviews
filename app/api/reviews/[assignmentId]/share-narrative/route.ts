import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { assignmentId } = await ctx.params;
    const supabase = await createSupabaseServerClient();

    const body = await req.json().catch(() => ({}));
    const share = Boolean(body?.share);

    const { data: review, error: reviewErr } = await supabase
      .from("reviews")
      .select("id, status, cycle_id, employee_id")
      .eq("assignment_id", assignmentId)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reviewErr) {
      return NextResponse.json({ error: reviewErr.message }, { status: 400 });
    }
    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

        
    // ✅ SERVER-SIDE GUARDS GO HERE (before update)
    if (review.status !== "submitted") {
      return NextResponse.json({ error: "Cannot toggle until review is submitted" }, { status: 400 });
    }

    // you need releasedAt from review_cycles or your resolver
    const { data: cycle, error: cycleErr } = await supabase
      .from("review_cycles")
      .select("released_at")
      .eq("id", review.cycle_id)
      .maybeSingle();

    if (cycleErr) return NextResponse.json({ error: cycleErr.message }, { status: 400 });

    if (cycle?.released_at) {
      return NextResponse.json({ error: "Cannot toggle after cycle is released" }, { status: 400 });
    }

    // isAdmin check depends on your auth model (profiles/admin_users/etc)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Example: if you have an admin_users table keyed by user.id
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!adminRow) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error: updErr } = await supabase
      .from("reviews")
      .update({ narrative_share_with_employee: share })
      .eq("id", review.id);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, share });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unexpected error" },
      { status: 400 }
    );
  }
}
