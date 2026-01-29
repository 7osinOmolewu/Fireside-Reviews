import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { job_role_id, hire_date, full_name, email } = body ?? {};

    // Validate job_role_id dynamically (if provided)
    let newRoleCode: string | null = null;
    if (job_role_id !== undefined) {
      if (job_role_id === null || job_role_id === "") {
        // allow clearing
      } else if (typeof job_role_id !== "string") {
        return NextResponse.json(
          { error: "job_role_id must be a string uuid or null" },
          { status: 400 }
        );
      } else {
        const { data: roleRow, error: roleErr } = await supabaseAdmin
          .from("job_roles")
          .select("id,code")
          .eq("id", job_role_id)
          .single();

        if (roleErr) {
          return NextResponse.json({ error: roleErr.message }, { status: 400 });
        }
        if (!roleRow) {
          return NextResponse.json(
            { error: `Invalid job_role_id: ${job_role_id}` },
            { status: 400 }
          );
        }
        newRoleCode = roleRow.code;
      }
    }

    if (email !== undefined) {
      if (email !== null && (typeof email !== "string" || email.trim() === "")) {
        return NextResponse.json(
          { error: "email must be a non-empty string or null" },
          { status: 400 }
        );
      }

      const { error: emailErr } = await supabaseAdmin
        .from("profiles")
        .update({ email: email === null ? null : email.trim().toLowerCase() })
        .eq("id", id);

      if (emailErr) {
        return NextResponse.json({ error: emailErr.message }, { status: 400 });
      }
    }

    // Update profiles.full_name (ONLY if provided)
    if (full_name !== undefined) {
      if (typeof full_name !== "string" || full_name.trim() === "") {
        return NextResponse.json(
          { error: "full_name must be a non-empty string" },
          { status: 400 }
        );
      }

      const { error: profErr } = await supabaseAdmin
        .from("profiles")
        .update({ full_name: full_name.trim() })
        .eq("id", id);

      if (profErr) {
        return NextResponse.json({ error: profErr.message }, { status: 400 });
      }
    }

    // Pull current employee row if we might need to regen code
    let currentRoleId: string | null = null;
    if (job_role_id !== undefined) {
      const { data: currentEmp, error: curErr } = await supabaseAdmin
        .from("employees")
        .select("job_role_id")
        .eq("id", id)
        .maybeSingle();

      if (curErr) {
        return NextResponse.json({ error: curErr.message }, { status: 400 });
      }

      currentRoleId = currentEmp?.job_role_id ?? null;
    }

    // Update employees table
    const patch: Record<string, any> = {};
    if (hire_date !== undefined) patch.hire_date = hire_date;

    if (job_role_id !== undefined) {
      const normalized = job_role_id === "" ? null : job_role_id;

      patch.job_role_id = normalized;

      // If clearing role, clear employee_code to avoid mismatch
      if (normalized === null) {
        patch.employee_code = null;
      }

      // If role changed and not null, regenerate employee_code
      if (normalized !== null && normalized !== currentRoleId) {
        const { data: codeRow, error: codeErr } = await supabaseAdmin.rpc(
          "generate_employee_code", { p_job_role_id: normalized }
        )


        if (codeErr) {
          return NextResponse.json({ error: codeErr.message }, { status: 400 });
        }

        patch.employee_code = (codeRow as unknown as string) ?? null;
      }
    }

    if (Object.keys(patch).length > 0) {
      const { error: empErr } = await supabaseAdmin
        .from("employees")
        .update(patch)
        .eq("id", id);

      if (empErr) {
        return NextResponse.json({ error: empErr.message }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
