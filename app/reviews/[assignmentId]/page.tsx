import { redirect } from "next/navigation";
import ReviewForm from "./review-form";
import type { QueryData } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import type { AssignmentPayload } from "@/lib/types/reviews";

const assignmentQuery = (supabase: Awaited<ReturnType<typeof import("@/lib/supabaseServer").createSupabaseServerClient>>) =>
  supabase
    .from("review_assignments")
    .select(
      `
      id,
      reviewer_type,
      cycle_id,
      employee_id,
      employees ( job_role_id ),
      reviews (
        id,
        status,
        summary_reviewer_private,
        summary_employee_visible,
        submitted_at,
        review_scores (
          review_id,
          category_scores,
          base_score,
          calibration_adjustment,
          final_score,
          updated_at
        )
      )
    `
    )
    .eq("id", "" as any) // placeholder, we’ll override in the function
    .single();

export default async function ReviewAssignmentPage(props: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await props.params;

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login");

  // Load assignment + existing review + existing scores
  // NOTE: include employees(job_role_id) so we can pick the right rubric for the cycle
  const { data: assignment, error } = await supabase
  .from("review_assignments")
  .select(`
    id,
    reviewer_type,
    cycle_id,
    employee_id,
    employees ( job_role_id ),
    reviews (
      id,
      status,
      summary_reviewer_private,
      summary_employee_visible,
      submitted_at,
      review_scores (
        review_id,
        category_scores,
        base_score,
        calibration_adjustment,
        final_score,
        updated_at
      )
    )
  `)
  .eq("id", assignmentId)
  .single<AssignmentPayload>();

  if (error)
    return <pre style={{ padding: 16 }}>{JSON.stringify(error, null, 2)}</pre>;

  // Define these AFTER we know assignment exists
  const employeeRow = Array.isArray(assignment.employees)
  ? assignment.employees[0]
  : assignment.employees;
  const jobRoleId = employeeRow?.job_role_id ?? null;

  const cycleId = assignment.cycle_id;

  // Load rubrics configured for this cycle (prefer role-specific, fallback to general)
  const { data: cycleRubrics, error: crErr } = await supabase
    .from("cycle_rubrics")
    .select(`
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
    `)
    .eq("cycle_id", cycleId)
    .order("created_at", { ascending: true });

  if (crErr)
    return <pre style={{ padding: 16 }}>{JSON.stringify(crErr, null, 2)}</pre>;

  const chosen =
    cycleRubrics?.find((r) => r.job_role_id && r.job_role_id === jobRoleId) ??
    cycleRubrics?.find((r) => r.job_role_id === null) ??
    null;

  const rubricCategories = ((chosen as any)?.rubrics?.rubric_categories as any[]) ?? [];

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <ReviewForm
        assignment={assignment as any}
        rubricCategories={rubricCategories as any[]}
      />
    </div>
  );
}
