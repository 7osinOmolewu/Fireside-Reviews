// app/api/admin/set-active-cycle/route.ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  try {
    const { supabase } = await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const cycleId = String(body?.cycleId ?? "");

    if (!UUID_RE.test(cycleId)) {
      return NextResponse.json({ error: "Invalid cycleId" }, { status: 400 });
    }

    const { error } = await (supabase as any)
      .from("app_settings")
      .upsert({ id: "global", active_cycle_id: cycleId }, { onConflict: "id" });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
