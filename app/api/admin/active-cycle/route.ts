import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PUT(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authErr } = await supabase.auth.getUser();

  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 401 });
  }

  if (!auth?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // admin check
  const { data: adminRow, error: adminErr } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (adminErr) {
    return NextResponse.json({ error: adminErr.message }, { status: 500 });
  }

  if (!adminRow?.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const cycleId = typeof body?.cycleId === "string" ? body.cycleId : "";

  if (!UUID_RE.test(cycleId)) {
    return NextResponse.json({ error: "Invalid cycleId" }, { status: 400 });
  }

  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "active_cycle_id", value: cycleId }, { onConflict: "key" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authErr } = await supabase.auth.getUser();

  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 401 });
  }

  if (!auth?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // admin check
  const { data: adminRow, error: adminErr } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (adminErr) {
    return NextResponse.json({ error: adminErr.message }, { status: 500 });
  }

  if (!adminRow?.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("app_settings")
    .select("value, updated_at")
    .eq("key", "active_cycle_id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    activeCycleId: (data?.value as string | null) ?? null,
    updatedAt: data?.updated_at ?? null,
  });
}

