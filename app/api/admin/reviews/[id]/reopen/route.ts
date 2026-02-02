import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reviewId = params.id;

  // Fetch current review state
  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .select("id, status")
    .eq("id", reviewId)
    .single();

  if (reviewError || !review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  if (review.status !== "submitted" && review.status !== "finalized") {
    return NextResponse.json(
      { error: "Only submitted reviews can be reopened" },
      { status: 400 }
    );
  }

  // Call RPC
  const { error: rpcError } = await supabase.rpc("admin_reopen_review", {
    p_review_id: reviewId,
  });

  if (rpcError) {
    return NextResponse.json(
      { error: rpcError.message },
      { status: 500 }
    );
  }

  // Audit log
  const { error: auditLogError } = await supabase.from("audit_log").insert({
    action: "review_reopened",
    entity_type: "review",
    entity_id: reviewId,
    actor_user_id: user.id,
    before_state: { status: review.status },
    after_state: { status: "draft" },
  });

  if (auditLogError) {
    return NextResponse.json(
      { error: auditLogError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
