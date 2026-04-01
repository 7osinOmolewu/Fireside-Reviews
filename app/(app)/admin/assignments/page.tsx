import { redirect } from "next/navigation";
import { PageHeader } from "@/app/_components/page-header";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { resolveCycleServer } from "@/lib/activeCycleServer";
import { ReviewOpsWorkbench } from "./ReviewOpsWorkbench";

type EmployeeRow = {
  id: string;
  employee_code: string | null;
  profiles:
    | {
        full_name: string | null;
        email: string | null;
      }
    | {
        full_name: string | null;
        email: string | null;
      }[]
    | null;
  job_roles:
    | {
        id: string;
        name: string;
        code: string;
      }
    | {
        id: string;
        name: string;
        code: string;
      }[]
    | null;
};

type AssignmentRow = {
  id: string;
  employee_id: string;
  reviewer_id: string;
  reviewer_type: "primary" | "self" | "secondary" | "peer";
  is_required: boolean;
  is_active: boolean;
  profiles:
    | {
        full_name: string | null;
        email: string | null;
      }
    | {
        full_name: string | null;
        email: string | null;
      }[]
    | null;
};

type ReviewRow = {
  id: string;
  assignment_id: string;
  employee_id: string;
  reviewer_type: "primary" | "self" | "secondary" | "peer";
  status: "draft" | "submitted" | "finalized";
};

type InternalSummaryRow = {
  employee_id: string;
  finalized_at: string | null;
};

type PublicSummaryRow = {
  employee_id: string;
  released_at: string | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

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

  const cycle = await resolveCycleServer({
    userId: user.id,
    cycleIdFromQS: null,
  });

  if (!cycle.selectedCycleId) {
    return (
      <>
        <PageHeader
          title="Review Operations"
          description="Manage active-cycle review assignments, progress, and processing."
        />

        <div className="rounded-2xl border border-orange-100/70 bg-[#fff7f0]/70 p-5 shadow-sm">
          <div className="text-base font-semibold text-slate-900">No active cycle</div>
          <div className="mt-2 text-sm text-slate-600">
            Set an active cycle before managing review operations.
          </div>
        </div>
      </>
    );
  }

  const selectedCycleId = cycle.selectedCycleId;

  const [
    { data: cycleRow, error: cycleError },
    { data: employeeRowsRaw, error: employeesError },
    { data: assignmentRowsRaw, error: assignmentsError },
    { data: reviewRowsRaw, error: reviewsError },
    { data: internalSummaryRowsRaw, error: internalError },
    { data: publicSummaryRowsRaw, error: publicError },
  ] = await Promise.all([
    supabase
      .from("review_cycles")
      .select("id, name, status")
      .eq("id", selectedCycleId)
      .maybeSingle(),

    supabase
      .from("employees")
      .select(
        `
        id,
        employee_code,
        profiles:profiles!employees_id_fkey (
          full_name,
          email
        ),
        job_roles:job_role_id (
          id,
          name,
          code
        )
      `
      )
      .order("created_at", { ascending: true }),

    supabase
      .from("review_assignments")
      .select(
        `
        id,
        employee_id,
        reviewer_id,
        reviewer_type,
        is_required,
        is_active,
         profiles:profiles!review_assignments_reviewer_id_fkey (
          full_name,
          email
         )
      `
      )
      .eq("cycle_id", selectedCycleId),

    supabase
      .from("reviews")
      .select("id, assignment_id, employee_id, reviewer_type, status")
      .eq("cycle_id", selectedCycleId),

    supabase
      .from("cycle_employee_summary")
      .select("employee_id, finalized_at")
      .eq("cycle_id", selectedCycleId),

    supabase
      .from("cycle_employee_summary_public")
      .select("employee_id, released_at")
      .eq("cycle_id", selectedCycleId),
  ]);

  if (
    cycleError ||
    employeesError ||
    assignmentsError ||
    reviewsError ||
    internalError ||
    publicError
  ) {
    throw (
      cycleError ||
      employeesError ||
      assignmentsError ||
      reviewsError ||
      internalError ||
      publicError
    );
  }

  const employees = ((employeeRowsRaw ?? []) as EmployeeRow[]).map((row) => {
    const profile = one(row.profiles);
    const jobRole = one(row.job_roles);

    return {
      id: row.id,
      fullName: profile?.full_name ?? "Unnamed employee",
      email: profile?.email ?? null,
      employeeCode: row.employee_code ?? null,
      jobRoleName: jobRole?.name ?? null,
      jobRoleCode: jobRole?.code ?? null,
    };
  });

  const assignments = ((assignmentRowsRaw ?? []) as AssignmentRow[]).map((row) => {
    const reviewerProfile = one(row.profiles);

    return {
      id: row.id,
      employeeId: row.employee_id,
      reviewerId: row.reviewer_id,
      reviewerType: row.reviewer_type,
      isRequired: row.is_required,
      isActive: row.is_active,
      reviewerName: reviewerProfile?.full_name ?? "Unknown reviewer",
      reviewerEmail: reviewerProfile?.email ?? null,
    };
  });

  const reviews = ((reviewRowsRaw ?? []) as ReviewRow[]).map((row) => ({
    id: row.id,
    assignmentId: row.assignment_id,
    employeeId: row.employee_id,
    reviewerType: row.reviewer_type,
    status: row.status,
  }));

  const internalSummaries = ((internalSummaryRowsRaw ?? []) as InternalSummaryRow[]).map((row) => ({
    employeeId: row.employee_id,
    finalizedAt: row.finalized_at,
  }));

  const publicSummaries = ((publicSummaryRowsRaw ?? []) as PublicSummaryRow[]).map((row) => ({
    employeeId: row.employee_id,
    releasedAt: row.released_at,
  }));

  return (
    <>
      <PageHeader
        title="Review Operations"
        description="Manage active-cycle reviewer assignments, review progress, and employee processing."
      />

      <ReviewOpsWorkbench
        cycleId={selectedCycleId}
        cycleName={cycleRow?.name ?? "Active cycle"}
        cycleStatus={cycleRow?.status ?? cycle.cycleLabel}
        employees={employees}
        assignments={assignments}
        reviews={reviews}
        internalSummaries={internalSummaries}
        publicSummaries={publicSummaries}
      />
    </>
  );
}