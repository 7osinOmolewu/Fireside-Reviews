import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/app/_components/page-header";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning";
}) {
  const toneClasses: Record<string, string> = {
    neutral: "bg-slate-50 text-slate-700 ring-slate-200",
    success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    warning: "bg-amber-50 text-amber-800 ring-amber-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
        toneClasses[tone] ?? toneClasses.neutral
      )}
    >
      {label}
    </span>
  );
}

type AdminCardProps = {
  title: string;
  description: string;
  href: string;
  eyebrow?: string;
};

function AdminCard({ title, description, href, eyebrow }: AdminCardProps) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-orange-100/70 bg-[#fff7f0]/55 p-5 shadow-sm transition hover:-translate-y-0.5 hover:bg-[#fff7f0]/80 hover:shadow-[0_10px_30px_rgba(249,115,22,0.08)]"
    >
      <div className="flex h-full flex-col">
        {eyebrow ? (
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {eyebrow}
          </div>
        ) : null}

        <div className="mt-2 text-base font-semibold text-slate-900">{title}</div>
        <div className="mt-1 text-sm leading-relaxed text-slate-600">{description}</div>

        <div className="mt-4 inline-flex items-center text-sm font-semibold text-slate-900">
          Open
          <span className="ml-1 transition group-hover:translate-x-0.5">→</span>
        </div>
      </div>
    </Link>
  );
}

export default async function AdminLandingPage() {
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const userName = profile?.full_name ?? profile?.email ?? "Admin";

  const [cyclesResult, employeesResult, assignmentsResult, jobRolesResult] = await Promise.all([
    supabase.from("review_cycles").select("id, status", { count: "exact" }),
    supabase.from("employees").select("id", { count: "exact" }),
    supabase
      .from("review_assignments")
      .select("id", { count: "exact" })
      .eq("is_active", true),
    supabase.from("job_roles").select("id", { count: "exact" }),
  ]);

  const openCycleCount =
    (cyclesResult.data ?? []).filter((c) => c.status === "calibrating").length;

  const totalCycleCount = cyclesResult.count ?? 0;
  const employeeCount = employeesResult.count ?? 0;
  const activeAssignmentCount = assignmentsResult.count ?? 0;
  const jobFamilyCount = jobRolesResult.count ?? 0;

  return (
    <>
      <PageHeader
        title="Admin"
        description="Manage cycles, assignments, employees, and supporting review configuration."
      />

      <div className="space-y-5">
        <div className="rounded-2xl border border-orange-100/70 bg-[#fff7f0]/70 p-5 shadow-[0_10px_30px_rgba(249,115,22,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-lg font-semibold text-slate-900">
                  Welcome, {userName}
                </div>
                <Badge label="Admin workspace" tone="warning" />
              </div>

              <div className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
                This is the operational control area for Fireside Reviews. Use it to manage
                review cycles, maintain employee and assignment data, and support the review
                process without changing underlying workflow behavior.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-orange-100/70 bg-[#fffdfb]/80 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Open Cycles
                </div>
                <div className="mt-1 text-xl font-semibold text-slate-900">{openCycleCount}</div>
              </div>

              <div className="rounded-2xl border border-orange-100/70 bg-[#fffdfb]/80 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Employees
                </div>
                <div className="mt-1 text-xl font-semibold text-slate-900">{employeeCount}</div>
              </div>

              <div className="rounded-2xl border border-orange-100/70 bg-[#fffdfb]/80 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Active Assignments
                </div>
                <div className="mt-1 text-xl font-semibold text-slate-900">{activeAssignmentCount}</div>
              </div>

              <div className="rounded-2xl border border-orange-100/70 bg-[#fffdfb]/80 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Job Families
                </div>
                <div className="mt-1 text-xl font-semibold text-slate-900">{jobFamilyCount}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-orange-100/70 bg-[#fffdfb]/60 p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-slate-900">System snapshot</div>
            <Badge label={`${totalCycleCount} total cycle(s)`} tone="neutral" />
            <Badge label={`${openCycleCount} open cycle(s)`} tone={openCycleCount > 0 ? "success" : "neutral"} />
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <AdminCard
            eyebrow="Current Cycle"
            title="Review Operations"
            description="Track review progress, manage assignments, and process employee reviews for the active cycle."
            href="/admin/assignments"
          />

          <AdminCard
            eyebrow="Current Cycle"
            title="Cycles"
            description="Create and manage review cycles, set the active cycle, and control timing."
            href="/admin/cycles"
          />

          <AdminCard
            eyebrow="People"
            title="Employees"
            description="Manage employee records, roles, and access, with entry into individual review workflows."
            href="/admin/employees"
          />

          <AdminCard
            eyebrow="Structure"
            title="Roles & Rubrics"
            description="Define job roles and associated performance standards used during reviews."
            href="/admin/job-families"
          />

          <AdminCard
            eyebrow="History"
            title="Archives"
            description="Access historical performance records for employees removed from the system."
            href="/admin/archives"
          />
        </div>
      </div>
    </>
  );
}