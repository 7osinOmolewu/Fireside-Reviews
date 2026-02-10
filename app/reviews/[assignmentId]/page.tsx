import { redirect } from "next/navigation";
import ReviewForm from "./review-form";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getCycleLabel } from "@/lib/cycleLabel";
import { resolveCycleServer } from "@/lib/activeCycleServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ReviewAssignmentPage(props: {
  params: Promise<{ assignmentId: string }>;
  searchParams?: Promise<{ cycleId?: string }>;
}) {
  const { assignmentId } = await props.params;

  const sp = props.searchParams ? await props.searchParams : {};
  const cycleIdFromQS = sp.cycleId ?? null;

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login");

  // 1) Assignment row only
  const { data: assignment, error } = await supabase
    .from("review_assignments")
    .select("id, reviewer_id, reviewer_type, cycle_id, employee_id")
    .eq("id", assignmentId)
    .maybeSingle();

  if (error) return <pre style={{ padding: 16 }}>{JSON.stringify(error, null, 2)}</pre>;
  if (!assignment) {
    return <pre style={{ padding: 16 }}>No assignment found for id: {assignmentId}</pre>;
  }

  // 2) Employee + profile (safe)
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

  // Attach employees in the shape ReviewForm expects
  (assignment as any).employees = employeeRow
    ? [{ ...employeeRow, profiles: (employeeRow as any).profiles }]
    : null;

  // 3) Latest review row for this assignment
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

  if (revErr) return <pre style={{ padding: 16 }}>{JSON.stringify(revErr, null, 2)}</pre>;

  (assignment as any).reviews = reviews ?? [];

  // 4) Latest score row (do not rely on embedded review_scores)
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

    if (scoreErr) return <pre style={{ padding: 16 }}>{JSON.stringify(scoreErr, null, 2)}</pre>;

    (assignment as any).reviews[0].review_scores = scoreRow ? [scoreRow] : [];
  }

  // 5) Rubric categories (cycle-scoped)
  const jobRoleId: string | null = employeeRow?.job_role_id ?? null;
  const assignmentCycleId = assignment.cycle_id;

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
    .eq("cycle_id", assignmentCycleId)
    .order("created_at", { ascending: true });

  if (crErr) return <pre style={{ padding: 16 }}>{JSON.stringify(crErr, null, 2)}</pre>;

  const chosen =
    cycleRubrics?.find((r) => r.job_role_id && r.job_role_id === jobRoleId) ??
    cycleRubrics?.find((r) => r.job_role_id === null) ??
    null;

  const rubricCategories = ((chosen as any)?.rubrics?.rubric_categories as any[]) ?? [];

  // ===== Pending nav list (match /reviews page order + filters) =====
  const cycle = await resolveCycleServer({
    userId: auth.user.id,
    cycleIdFromQS,
  });

  const cycleIdsToUse = cycle.cycleIdsToUse;

  const { data: navAssignments, error: navAssignErr } = await supabase
    .from("review_assignments")
    .select("id, created_at")
    .eq("reviewer_id", auth.user.id)
    .eq("is_active", true)
    .in("cycle_id", cycleIdsToUse)
    .order("created_at", { ascending: false });

  if (navAssignErr) return <pre style={{ padding: 16 }}>{JSON.stringify(navAssignErr, null, 2)}</pre>;

  const pendingAssignmentIds: string[] = (navAssignments ?? []).map((a) => a.id);
  const isPending = pendingAssignmentIds.includes(assignmentId);
 
  // Fetch cycle names needed for label (open cycles + selected cycle)
  const cycleIdsForLabel = Array.from(
    new Set([...(cycle.openCycleIds ?? []), ...(cycle.selectedCycleId ? [cycle.selectedCycleId] : [])])
  );

  const { data: cyclesForLabel, error: cyclesLabelErr } = cycleIdsForLabel.length
    ? await supabase.from("review_cycles").select("id, name, status").in("id", cycleIdsForLabel)
    : { data: [], error: null };

  if (cyclesLabelErr) return <pre style={{ padding: 16 }}>{JSON.stringify(cyclesLabelErr, null, 2)}</pre>;

  const cycleById = new Map<string, string>((cyclesForLabel ?? []).map((c) => [c.id, c.name]));

  const cycleLabel = getCycleLabel({
    selectedCycleId: cycle.selectedCycleId,
    openCycleIds: cycle.openCycleIds,
    cycleById,
  });

  const cycleQS = cycle.cycleQS;

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <ReviewForm
        key={assignmentId}
        assignment={assignment as any}
        rubricCategories={rubricCategories as any[]}
        pendingAssignmentIds={pendingAssignmentIds}
        isPending={isPending}
        cycleLabel={cycleLabel}
        cycleQS={cycleQS}
      />
    </div>
  );
}
