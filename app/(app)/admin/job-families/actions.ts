"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

function normalizeCode(input: string) {
  return input
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

export async function createJobFamily(code: string, name: string) {
  await requireAdmin();

  const supabase = await createSupabaseServerClient();

  const c = normalizeCode(code);
  const n = name.trim();

  if (!c) return { ok: false, error: "Code is required." };
  if (!n) return { ok: false, error: "Name is required." };

  const { error } = await supabase.from("job_roles").insert({ code: c, name: n });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/job-families");
  revalidatePath("/admin/employees");
  revalidatePath("/admin/assignments");
  return { ok: true };
}

export async function updateJobFamilyName(code: string, name: string) {
  await requireAdmin();

  const supabase = await createSupabaseServerClient();

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name cannot be empty." };

  const { error } = await supabase
    .from("job_roles")
    .update({ name: trimmed })
    .eq("code", code);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/job-families");
  revalidatePath("/admin/employees");
  return { ok: true };
}

export async function deleteJobFamily(code: string) {
  await requireAdmin();

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("job_roles").delete().eq("code", code);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/job-families");
  revalidatePath("/admin/employees");
  return { ok: true };
}
