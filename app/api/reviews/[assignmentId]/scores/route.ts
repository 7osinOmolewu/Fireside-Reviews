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

  const body = await req.json();
  const category_scores =
    body?.category_scores && typeof body.category_scores === "object"
      ? body.category_scores
      : null;

  if (!category_scores) {
    return NextResponse.json({ error: "category_scores must be an object" }, { status: 400 });
  }

  // Must have a review row first
  const { data: review, error: rErr } = await supabase
    .from("reviews")
    .select("id, reviewer_id, reviewer_type, status")
    .eq("assignment_id", assignmentId)
    .maybeSingle();

  if (rErr) return NextResponse.json({ error: rErr }, { status: 400 });
  if (!review?.id) return NextResponse.json({ error: "Review not found for assignment" }, { status: 400 });

  if (review.reviewer_id !== auth.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (review.reviewer_type !== "primary") return NextResponse.json({ error: "Only primary can score" }, { status: 403 });

  const { error: upErr } = await supabase
    .from("review_scores")
    .upsert(
      {
        review_id: review.id,
        category_scores,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "review_id" }
    );

  if (upErr) return NextResponse.json({ error: upErr }, { status: 400 });

  return NextResponse.json({ ok: true });
}
