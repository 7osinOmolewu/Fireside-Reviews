import Link from "next/link";
import { PageHeader } from "@/app/_components/page-header";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import type { Database } from "@/lib/database.types";
import { resolveCycleServer } from "@/lib/activeCycleServer";
import { getCycleLabel } from "@/lib/cycleLabel";
import Image from "next/image";

type ReviewAssignmentRow = Database["public"]["Tables"]["review_assignments"]["Row"];
type EmployeeRow = Database["public"]["Tables"]["employees"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type JobRoleRow = Database["public"]["Tables"]["job_roles"]["Row"];
type ReviewRow = Database["public"]["Tables"]["reviews"]["Row"];

type AssignmentWithEmployee = ReviewAssignmentRow & {
  employees: (EmployeeRow & {
    profiles: ProfileRow | null;
    job_roles: JobRoleRow | null;
  }) | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function withStatusQS(cycleQS: string, status?: "draft" | "submitted" | null) {
  const base = cycleQS && cycleQS.startsWith("?") ? cycleQS : "";
  if (!status) return base;
  return base ? `${base}&status=${status}` : `?status=${status}`;
}

function withoutStatusQS(cycleQS: string) {
  return cycleQS && cycleQS.startsWith("?") ? cycleQS : "";
}

function Badge({
  label,
  tone = "neutral",
  title,
}: {
  label: string;
  tone?: "neutral" | "success" | "warning";
  title?: string;
}) {
  const toneClasses: Record<string, string> = {
    neutral: "bg-slate-50 text-slate-700 ring-slate-200",
    success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    warning: "bg-amber-50 text-amber-800 ring-amber-200",
  };

  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
        toneClasses[tone] ?? toneClasses.neutral
      )}
    >
      {label}
    </span>
  );
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ cycleId?: string; status?: "draft" | "submitted" }>;
}) {
  const { cycleId, status } = await searchParams;
  const statusFilter = status ?? null;

  const cycleIdFromQS = cycleId ?? null;

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const cycle = await resolveCycleServer({
    userId: user.id,
    cycleIdFromQS,
  });

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = !!adminRow;

  // Cycle label support
  const cycleIdsForLabel = Array.from(
    new Set([
      ...(cycle.openCycleIds ?? []),
      ...(cycle.selectedCycleId ? [cycle.selectedCycleId] : []),
    ])
  );

  const { data: cyclesForLabel, error: cyclesError } = cycleIdsForLabel.length
    ? await supabase
        .from("review_cycles")
        .select("id, name, status")
        .in("id", cycleIdsForLabel)
    : { data: [], error: null };

  if (cyclesError) return <pre className="p-4">{JSON.stringify(cyclesError, null, 2)}</pre>;

  const cycleById = new Map<string, string>((cyclesForLabel ?? []).map((c) => [c.id, c.name]));

  const cycleIdsToUse = cycle.cycleIdsToUse;

  if (cycleIdsToUse.length === 0) {
    return (
      <div className="p-6">
        <PageHeader title="Reviews" description="My review inbox (no active cycle found)" />
        <div className="mt-4 rounded-xl border bg-white p-6 text-sm text-slate-600">
          No active cycle is available (no open cycles found).
        </div>
      </div>
    );
  }

  const cycleQS = cycle.cycleQS;

  const cycleLabel = getCycleLabel({
    selectedCycleId: cycle.selectedCycleId,
    openCycleIds: cycle.openCycleIds,
    cycleById,
  });

  const listQS = withStatusQS(cycleQS, statusFilter);

  // 2) Fetch assignments
  const { data, error } = await supabase
    .from("review_assignments")
    .select(
      `
      id,
      reviewer_type,
      cycle_id,
      employee_id,
      created_at,
      employees (
        id,
        employee_code,
        profiles ( id, full_name ),
        job_roles ( id, name, code )
      )
    `
    )
    .eq("reviewer_id", user.id)
    .eq("is_active", true)
    .in("cycle_id", cycleIdsToUse)
    .order("created_at", { ascending: false });

  if (error) return <pre className="p-4">{JSON.stringify(error, null, 2)}</pre>;

  let assignments = (data ?? []) as unknown as AssignmentWithEmployee[];

  // 3) Fetch reviews
  const assignmentIds = assignments.map((a) => a.id);

  const { data: reviewsData, error: reviewsError } = assignmentIds.length
    ? await supabase
        .from("reviews")
        .select("id, assignment_id, status, submitted_at")
        .in("assignment_id", assignmentIds)
    : { data: [], error: null };

  if (reviewsError) return <pre className="p-4">{JSON.stringify(reviewsError, null, 2)}</pre>;

  const reviewByAssignmentId = new Map<string, Pick<ReviewRow, "id" | "status">>();
  (reviewsData ?? []).forEach((r) =>
    reviewByAssignmentId.set(r.assignment_id, { id: r.id, status: r.status })
  );

  const statusByAssignmentId = new Map<string, "draft" | "submitted">();
  
  assignments.forEach((a) => {
    const review = reviewByAssignmentId.get(a.id);
    const s = review?.status === "submitted" || review?.status === "finalized" ? "submitted" : "draft";
    statusByAssignmentId.set(a.id, s);
  });

  if (statusFilter) {
      assignments = [...assignments].sort((a, b) => {
        const sa = statusByAssignmentId.get(a.id) ?? "draft";
        const sb = statusByAssignmentId.get(b.id) ?? "draft";
        // bubble matches first, keep original relative order otherwise
        const am = sa === statusFilter ? 0 : 1;
        const bm = sb === statusFilter ? 0 : 1;
        return am - bm;
      });
  }

  // 4) Release state
  const employeeIds = Array.from(new Set(assignments.map((a) => a.employee_id).filter(Boolean)));

  const { data: releaseData, error: releaseError } = employeeIds.length
    ? await supabase
        .from("cycle_employee_summary_public")
        .select("cycle_id, employee_id, released_at")
        .in("cycle_id", cycleIdsToUse)
        .in("employee_id", employeeIds)
    : { data: [], error: null };

  if (releaseError) return <pre className="p-4">{JSON.stringify(releaseError, null, 2)}</pre>;

  const releasedByCycleEmployee = new Map<string, string | null>();
  (releaseData ?? []).forEach((r: any) =>
    releasedByCycleEmployee.set(`${r.cycle_id}:${r.employee_id}`, r.released_at ?? null)
  );

  // Derived counts (no workflow changes, just display)
  let submittedCount = 0;
  let draftCount = 0;

  assignments.forEach((a) => {
    const review = reviewByAssignmentId.get(a.id);
    const status = review?.status ?? null;
    const isSubmitted = status === "submitted" || status === "finalized";
    if (isSubmitted) submittedCount += 1;
    else draftCount += 1;
  });

 return (
  <>
    <PageHeader title="Reviews" description={`My review inbox (${cycleLabel})`} />

    {/* Warm page surface */}
        {/* Status guide */}
      <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-orange-100/70 bg-[#fff7f0]/70 p-4 sm:flex-row sm:items-center sm:justify-between shadow-[0_10px_30px_rgba(249,115,22,0.06)]">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold text-slate-900">
            Status guide
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge label="Review status: Draft" tone="warning" />
            <Badge label="Review status: Submitted ✔" tone="success" />
            <Badge
              label="Employee visibility: Not released"
              tone="neutral"
            />
            <Badge label="Employee visibility: Released" tone="success" />
          </div>
        </div>
      </div>

      {/* Showing X of Y row */}
      <div className="mt-3 flex items-center justify-between rounded-xl border border-orange-100/70 bg-[#fff7f0]/60 px-4 py-2 text-sm text-slate-700 shadow-[0_10px_30px_rgba(249,115,22,0.06)]">
        <div>
          Showing{" "}
          <span className="font-semibold text-slate-900">
            {assignments.length}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-slate-900">
            {assignments.length}
          </span>{" "}
          assignments
        </div>

        <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-orange-100/70 bg-[#fffdfb]/60 shadow-[0_10px_30px_rgba(249,115,22,0.06)]">
        <div className="px-4 py-2 text-sm">
          <Link
            href={`/reviews${withStatusQS(cycleQS, "draft")}`}
            className={cn(
              "font-semibold underline underline-offset-2",
              statusFilter === "draft" ? "text-slate-900" : "text-slate-700"
            )}
            title="Bubble draft reviews to the top"
          >
            Draft: <span className="text-slate-900">{draftCount}</span>
          </Link>
        </div>

        <div className="border-l px-4 py-2 text-sm">
          <Link
            href={`/reviews${withStatusQS(cycleQS, "submitted")}`}
            className={cn(
              "font-semibold underline underline-offset-2",
              statusFilter === "submitted" ? "text-slate-900" : "text-slate-700"
            )}
            title="Bubble submitted reviews to the top"
          >
            Submitted: <span className="text-slate-900">{submittedCount}</span>
          </Link>
        </div>

        {statusFilter ? (
          <div className="border-l px-3 py-2">
            <Link
              href={`/reviews${withoutStatusQS(cycleQS)}`}
              title="Clear status filter"
              className="inline-flex items-center justify-center rounded-full border border-orange-100/70 bg-[#fff7f0]/60 text-slate-700 hover:bg-orange-50"
              aria-label="Clear filter"
            >
              Clear Filter ✕
            </Link>
          </div>
        ) : null}

      </div>
      </div>

      {/* List */}
      <div className="mt-5 space-y-3">
        {assignments.map((a) => {
          const employeeName =
            a.employees?.profiles?.full_name ??
            a.employees?.employee_code ??
            "Unknown employee";

          const jobRole =
            a.employees?.job_roles?.name ??
            a.employees?.job_roles?.code ??
            "Unknown role";

          const review = reviewByAssignmentId.get(a.id);
          const reviewStatus = review?.status ?? null;

          const isSubmitted =
            reviewStatus === "submitted" || reviewStatus === "finalized";

          const reviewStatusLabel = isSubmitted
            ? "Review status: Submitted ✔"
            : "Review status: Draft";

          const reviewStatusTone = isSubmitted ? "success" : "warning";

          const releasedAt =
            releasedByCycleEmployee.get(
              `${a.cycle_id}:${a.employee_id}`
            ) ?? null;

          const isReleased = Boolean(releasedAt);

          const releaseLabel = isReleased
            ? "Employee visibility: Released"
            : "Employee visibility: Not released";

          const releaseTone = isReleased ? "success" : "neutral";

          const reviewerTypeLabel =
            a.reviewer_type === "primary"
              ? "Primary reviewer"
              : a.reviewer_type === "secondary"
              ? "Secondary reviewer"
              : a.reviewer_type === "peer"
              ? "Peer reviewer"
              : "Self review";

          return (
            <div key={a.id} className="rounded-2xl border border-orange-100/70 bg-[#fff7f0]/45 p-4 shadow-sm">
              <div className="flex items-start gap-5">
                {/* Logo block */}
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-100/70">
                  <Image
                    src="/brand/fireside-mark.png"
                    alt="Fireside"
                    width={32}
                    height={32}
                  />
                </div>

                {/* Left (name/role/reviewer type) */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-base font-semibold text-slate-900">
                      {employeeName}
                    </div>
                    <Badge label={reviewerTypeLabel} tone="neutral" />
                  </div>

                  <div className="mt-1 text-sm text-slate-600">
                    <span className="text-slate-500">Role:</span> {jobRole}
                  </div>
                </div>

                {/* Right (badges + CTA) */}
                <div className="ml-auto flex shrink-0 flex-col items-end gap-2">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Badge label={reviewStatusLabel} tone={reviewStatusTone as any} />
                    <Badge
                      label={releaseLabel}
                      tone={releaseTone as any}
                      title={releasedAt ? `Released at ${releasedAt}` : "Not released to employee yet"}
                    />
                  </div>

                  <Link
                    href={`/reviews/${a.id}${listQS}`}
                    className="inline-flex items-center justify-center rounded-xl border border-orange-200 bg-[#fff7f0] px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-orange-50"
                  >
                    Open review
                  </Link>
                </div>
              </div>
            </div>
          );
        })}

        {assignments.length === 0 && (
          <div className="rounded-2xl border border-dashed bg-white p-6 text-sm text-slate-600">
            No review assignments found for your user.
          </div>
        )}
      </div>
  
  </>
);
}