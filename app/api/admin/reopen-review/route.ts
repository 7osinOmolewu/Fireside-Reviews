import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  try {
    const { supabase } = await requireAdmin();

    const body = await req.json().catch(() => ({}));
    const reviewId = String(body?.reviewId ?? "");

    if (!UUID_RE.test(reviewId)) {
      return NextResponse.json({ error: "Invalid reviewId" }, { status: 400 });
    }

    // NOTE: Your generated TS types might not include this RPC name yet.
    // If TS complains, re-run Supabase type generation OR cast to `any` below.
    const { error } = await (supabase as any).rpc("admin_reopen_review", {
      p_review_id: reviewId,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
