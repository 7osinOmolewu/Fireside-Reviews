import { redirect } from "next/navigation";
import ReviewForm from "./review-form";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import type { AssignmentPayload } from "@/lib/types/reviews";
import { AdminReopenReviewButton } from "./AdminReopenReviewButton";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type AssignmentPayloadWithProfile = Omit<AssignmentPayload, "employees"> & {
  employees:
    | (AssignmentPayload["employees"] extends (infer U)[] ? U : AssignmentPayload["employees"])
    | null
    | Array<
        (AssignmentPayload["employees"] extends (infer U)[] ? U : AssignmentPayload["employees"]) & {
          profiles?:
            | {
                id: string;
                full_name: string | null;
                email: string | null;
              }
            | {
                id: string;
                full_name: string | null;
                email: string | null;
              }[];
        }
      >;
};

export default async function ReviewAssignmentPage(props: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await props.params;

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login");

  // ✅ IMPORTANT: order + limit nested reviews so reviews[0] is always the latest row
   // 1) Load the assignment + employee profile (NO embedded reviews here)
// LINE A: 1) Fetch the assignment row only (no joins) so `.single()` never lies to you
const { data: assignment, error } = await supabase
  .from("review_assignments")
  .select("id, reviewer_id, reviewer_type, cycle_id, employee_id")
  .eq("id", assignmentId)
  .maybeSingle();

if (error) return <pre style={{ padding: 16 }}>{JSON.stringify(error, null, 2)}</pre>;

// ADD THIS GUARD
if (!assignment) {
  return <pre style={{ padding: 16 }}>No assignment found for id: {assignmentId}</pre>;
}

// LINE B: 2) Fetch employee + profile separately (safe if missing)
const { data: employeeRow, error: empErr } = await supabase
  .from("employees")
  .select(
    `
    job_role_id,
    profiles (
      id,
      full_name,
      email
    )
  `
  )
  .eq("id", assignment.employee_id)
  .maybeSingle();

if (empErr) return <pre style={{ padding: 16 }}>{JSON.stringify(empErr, null, 2)}</pre>;

// Attach employees in the shape your ReviewForm expects
(assignment as any).employees = employeeRow
  ? [{ ...employeeRow, profiles: (employeeRow as any).profiles }]
  : null;

if (error)
  return <pre style={{ padding: 16 }}>{JSON.stringify(error, null, 2)}</pre>;

// 2) Load latest review row for this assignment (with latest scores)
const { data: reviews, error: revErr } = await supabase
  .from("reviews")
  .select(
    `
    id,
    assignment_id,
    cycle_id,
    employee_id,
    reviewer_id,
    reviewer_type,
    status,
    summary_reviewer_private,
    summary_employee_visible,
    submitted_at,
    updated_at,
    created_at,
    review_scores (
      review_id,
      category_scores,
      base_score,
      calibration_adjustment,
      final_score,
      updated_at,
      created_at
    )
  `
  )
  .eq("assignment_id", assignmentId)
  .order("updated_at", { ascending: false })
  .order("created_at", { ascending: false })
  .limit(1);

if (revErr)
  return <pre style={{ padding: 16 }}>{JSON.stringify(revErr, null, 2)}</pre>;

// Attach reviews so ReviewForm continues to work unchanged
// Attach reviews so ReviewForm continues to work unchanged
(assignment as any).reviews = reviews ?? [];

// ALSO attach latest score row (do not rely on embedded review_scores)
const reviewId = (reviews?.[0] as any)?.id ?? null;

if (reviewId) {
  const { data: scoreRow, error: scoreErr } = await supabase
    .from("review_scores")
    .select(
      `
      review_id,
      category_scores,
      base_score,
      calibration_adjustment,
      final_score,
      created_at,
      updated_at
    `
    )
    .eq("review_id", reviewId)
    .maybeSingle();

  if (scoreErr) {
    // show the real error (this will reveal RLS issues immediately)
    return <pre style={{ padding: 16 }}>{JSON.stringify(scoreErr, null, 2)}</pre>;
  }

   // If no score row yet, keep it empty (do NOT error)
  (assignment as any).reviews[0].review_scores = scoreRow ? [scoreRow] : [];
}

  const jobRoleId: string | null = employeeRow?.job_role_id ?? null;
  const cycleId = assignment.cycle_id;

  // Load rubrics configured for this cycle (prefer role-specific, fallback to general)
  const { data: cycleRubrics, error: crErr } = await supabase
    .from("cycle_rubrics")
    .select(
      `
      id,
      cycle_id,
      job_role_id,
      rubric_id,
      rubrics (
        id,
        rubric_categories (
          id,
          rubric_id,
          code,
          name,
          weight,
          description,
          is_scored,
          sort_order
        )
      )
    `
    )
    .eq("cycle_id", cycleId)
    .order("created_at", { ascending: true });

  if (crErr)
    return <pre style={{ padding: 16 }}>{JSON.stringify(crErr, null, 2)}</pre>;

  const chosen =
    cycleRubrics?.find((r) => r.job_role_id && r.job_role_id === jobRoleId) ??
    cycleRubrics?.find((r) => r.job_role_id === null) ??
    null;

  const rubricCategories = ((chosen as any)?.rubrics?.rubric_categories as any[]) ?? [];

// ===== Pending nav list (match /reviews page order + filters) =====

// 1) Open cycles (same as inbox: calibrating)
const { data: openCycles, error: cyclesErr } = await supabase
  .from("review_cycles")
  .select("id")
  .in("status", ["calibrating"]);

if (cyclesErr) return <pre style={{ padding: 16 }}>{JSON.stringify(cyclesErr, null, 2)}</pre>;

const openCycleIds = (openCycles ?? []).map((c) => c.id);

// 2) Assignments shown on inbox: reviewer_id + is_active + open cycles, ordered newest-first
const { data: navAssignments, error: navAssignErr } = await supabase
  .from("review_assignments")
  .select("id, created_at")
  .eq("reviewer_id", auth.user.id)
  .eq("is_active", true)
  .in("cycle_id", openCycleIds)
  .order("created_at", { ascending: false });

if (navAssignErr) return <pre style={{ padding: 16 }}>{JSON.stringify(navAssignErr, null, 2)}</pre>;

const navAssignmentIds = (navAssignments ?? []).map((a) => a.id);

// 3) Pull review statuses for those assignment ids (reviews are 1-per-assignment in your design)
const { data: navReviews, error: navReviewsErr } = navAssignmentIds.length
  ? await supabase
      .from("reviews")
      .select("assignment_id, status, updated_at, created_at")
      .in("assignment_id", navAssignmentIds)
  : { data: [], error: null };

if (navReviewsErr) return <pre style={{ padding: 16 }}>{JSON.stringify(navReviewsErr, null, 2)}</pre>;

const statusByAssignmentId = new Map<string, string>();
(navReviews ?? []).forEach((r: any) => {
  statusByAssignmentId.set(r.assignment_id, r.status);
});

// 4) Backlog ids in the *same order as inbox* (include submitted/finalized for view-only)
const pendingAssignmentIds: string[] = navAssignmentIds;

// If this assignment is in the backlog, allow arrows
const isPending = pendingAssignmentIds.includes(assignmentId);

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <ReviewForm
        key={assignmentId}
        assignment={assignment as any}
        rubricCategories={rubricCategories as any[]}
        pendingAssignmentIds={pendingAssignmentIds}
        isPending={isPending}
      />
    </div>
  );
}
