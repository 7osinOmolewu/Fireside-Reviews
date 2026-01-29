import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

export async function POST(req: Request) {
  try {
    await requireAdmin();
    
    const { email, full_name, job_role_id, hire_date } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    // Validate job_role_id dynamically (if provided)
    let roleCode: string | null = null;
    if (job_role_id) {
      const { data: role, error } = await supabaseAdmin
        .from("job_roles")
        .select("id,code")
        .eq("id", job_role_id)
        .single();

      if (error || !role) {
        return NextResponse.json(
          { error: `Invalid job_role_id: ${job_role_id}` },
          { status: 400 }
        );
      }
      roleCode = role.code;
    }

    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";

    const redirectTo = new URL("/auth/callback", origin).toString();

    const appUserRole: "employee" | "reviewer" | "admin" = "employee";

    const { data: invited, error: inviteErr } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: {
          full_name: full_name ?? null,
          user_role: appUserRole,
        },
      });

    if (inviteErr) {
      return NextResponse.json({ error: inviteErr.message }, { status: 400 });
    }

    const userId = invited.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "No user id returned" }, { status: 500 });
    }

    // Profiles upsert
    const { error: profErr } = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        full_name: full_name ?? null,
        email,
        user_role: appUserRole,
      },
      { onConflict: "id" }
    );

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 400 });
    }
    
    const normalized = job_role_id === "" ? null : job_role_id;

    // Employees upsert (only if job_role_id provided)
    if (job_role_id && roleCode) {
      const { data: codeRow, error: codeErr } = await supabaseAdmin.rpc(
        "generate_employee_code", { p_job_role_id: normalized }
      )


      if (codeErr) {
        return NextResponse.json({ error: codeErr.message }, { status: 400 });
      }

      const employee_code = (codeRow as unknown as string) ?? null;

      const { error: empErr } = await supabaseAdmin.from("employees").upsert(
        {
          id: userId,
          job_role_id,
          hire_date: hire_date ?? null,
          employee_code,
        },
        { onConflict: "id" }
      );

      if (empErr) {
        return NextResponse.json({ error: empErr.message }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true, userId });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
