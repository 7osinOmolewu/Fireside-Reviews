import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/app/_components/page-header";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export default async function AdminAssignmentsPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!adminRow) redirect("/");

  return (
    <>
      <PageHeader
        title="Assignments"
        description="Manage reviewer assignments and review routing."
      />

      <div className="space-y-4">
        <div className="rounded-2xl border border-orange-100/70 bg-[#fff7f0]/60 p-5 shadow-sm">
          <div className="text-base font-semibold text-slate-900">
            Assignments page re-render is next
          </div>
          <div className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
            This route is now using the shared authenticated shell and admin access check.
            The next step is to replace the legacy assignments UI with the new admin surface
            pattern.
          </div>

          <div className="mt-4">
            <Link
              href="/admin"
              className="inline-flex items-center justify-center rounded-xl border border-orange-200 bg-[#fff7f0] px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-orange-50"
            >
              Back to Admin
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}