// app/api/debug/rls/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr) {
    return NextResponse.json({ error: userErr.message }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "no user" }, { status: 401 });
  }

  const cycleId = "4e5b4394-8670-431b-9186-a4232cfbe005";
const employeeId = "0278c679-f164-4498-ba36-78b646249728";

const { data, error } = await supabase
  .from("cycle_employee_summary_public")
  .select("cycle_id, employee_id, released_at")
  .eq("cycle_id", cycleId)
  .eq("employee_id", employeeId)
  .maybeSingle();

return NextResponse.json({ data, error });

}
