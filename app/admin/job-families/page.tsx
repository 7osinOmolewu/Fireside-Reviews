import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import JobFamiliesTable from "./table";

import Link from "next/link";

export function BackToAdmin() {
  return (
    <div style={{ marginBottom: 16 }}>
      <Link href="/admin" style={{ textDecoration: "underline" }}>
        Back to Admin
      </Link>
    </div>
  );
}

export default async function JobFamiliesPage() {
  await requireAdmin();

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("job_roles")
    .select("code,name")
    .order("code", { ascending: true });

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Job Families</h1>
        <div className="mt-3 text-red-600">{error.message}</div>
        <BackToAdmin />
        <p className="mt-3 text-red-600">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Job Families</h1>

      <div className="mt-6">
        <JobFamiliesTable rows={data ?? []} />
      </div>
      <div style={{ marginTop: 24 }}><BackToAdmin /></div>
    </div>
  );
}
