import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { resolveCycleServer } from "@/lib/activeCycleServer";

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function normalizeEmployeeIds(employeeIdsParam?: string | string[]) {
  const raw = Array.isArray(employeeIdsParam)
    ? employeeIdsParam.join(",")
    : employeeIdsParam ?? "";

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function getEmployeeReviewWorkspaceData(employeeId: string) {
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

  const selectedCycleId = cycle.selectedCycleId;

  const { data: employeeRow, error: employeeError } = await supabase
    .from("employees")
    .select(
      `
      id,
      employee_code,
      hire_date,
      job_roles:job_role_id ( id, code, name ),
      profiles:profiles!employees_id_fkey ( full_name, email )
    `
    )
    .eq("id", employeeId)
    .maybeSingle();

  if (employeeError) throw employeeError;
  if (!employeeRow) notFound();

  const profile = one(employeeRow.profiles);
  const jobRole = one(employeeRow.job_roles);

  const employeeName = profile?.full_name ?? "Unnamed employee";
  const employeeEmail = profile?.email ?? null;
  const employeeCode = employeeRow.employee_code ?? null;
  const employeeHireDate = employeeRow.hire_date ?? null;
  const jobRoleName = jobRole?.name ?? null;
  const employeeJobRoleId = jobRole?.id ?? null;

  const employee = {
    id: employeeRow.id,
    employee_code: employeeCode,
    hire_date: employeeHireDate,
    profiles: {
      full_name: employeeName,
      email: employeeEmail,
    },
    job_roles: jobRole
      ? {
          id: jobRole.id,
          code: jobRole.code,
          name: jobRole.name,
        }
      : null,
  };

  if (!selectedCycleId) {
    return {
      user,
      selectedCycleId: null,
      cycleId: null,
      cycleLabel: "No active cycle",
      cycleRow: null,
      employeeRow,
      employee,
      employeeName,
      employeeEmail,
      employeeCode,
      employeeHireDate,
      jobRoleName,
      employeeJobRoleId,
      reviewerOptions: [],
      assignments: [],
      reviews: [],
      selfReview: null,
      primaryReview: null,
      secondaryReview: null,
      peerReviews: [],
      reviewScoreByReviewId: new Map<string, any>(),
      primaryScore: null,
      selfSubmitted: false,
      primarySubmitted: false,
      hasPrimaryCategoryScores: false,
      finalized: false,
      released: false,
      canFinalize: false,
      canRelease: false,
      finalizeDisabledReason: "No active cycle.",
      releaseDisabledReason: "No active cycle.",
      summaryRaw: null as any,
      summaryPublicRaw: null as any,
      suggestedFinalNarrative: "",
      initialNarrative: "",
      initialCalibrationReason: "",
      initialCalibrationAdjustment: 0,
      initialFinalizedAt: null,
      initialReleasedAt: null,
      scorePreview: {
        baseScore: null,
        finalScore: null,
        performanceRating: null,
      },
      state: { label: "Needs review", tone: "warm" as const },
    };
  }

  const [
    { data: cycleRow, error: cycleError },
    { data: reviewersRaw, error: reviewersError },
    { data: assignmentsRaw, error: assignmentsError },
    { data: reviewsRaw, error: reviewsError },
    { data: summaryRaw, error: summaryError },
    { data: summaryPublicRaw, error: summaryPublicError },
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
        job_roles:job_role_id ( id, name ),
        profiles:profiles!employees_id_fkey ( full_name, email )
      `
      )
      .order("created_at", { ascending: true }),

    supabase
      .from("review_assignments")
      .select(
        `
        id,
        reviewer_id,
        reviewer_type,
        is_required,
        is_active,
        created_at,
        profiles:profiles!review_assignments_reviewer_id_fkey ( full_name, email )
      `
      )
      .eq("cycle_id", selectedCycleId)
      .eq("employee_id", employeeId)
      .eq("is_active", true)
      .order("reviewer_type", { ascending: true })
      .order("created_at", { ascending: true }),

    supabase
      .from("reviews")
      .select(
        `
        id,
        assignment_id,
        reviewer_id,
        reviewer_type,
        status,
        summary_employee_visible,
        narrative_share_with_employee,
        submitted_at,
        finalized_at,
        created_at,
        updated_at,
        profiles:profiles!reviews_reviewer_id_fkey ( full_name, email ),
        review_assignments!inner (
          is_active
        )
      `
      )
      .eq("cycle_id", selectedCycleId)
      .eq("employee_id", employeeId)
      .eq("review_assignments.is_active", true)
      .order("created_at", { ascending: true }),

    supabase
      .from("cycle_employee_summary")
      .select(
        `
        cycle_id,
        employee_id,
        primary_review_id,
        primary_final_score,
        performance_rating,
        final_narrative_employee_visible,
        calibration_reason,
        finalized_at,
        computed_at
      `
      )
      .eq("cycle_id", selectedCycleId)
      .eq("employee_id", employeeId)
      .maybeSingle(),

    supabase
      .from("cycle_employee_summary_public")
      .select(
        `
        cycle_id,
        employee_id,
        performance_rating,
        performance_rating_value,
        final_narrative_employee_visible,
        finalized_at,
        released_at,
        released_by
      `
      )
      .eq("cycle_id", selectedCycleId)
      .eq("employee_id", employeeId)
      .maybeSingle(),
  ]);

  if (
    cycleError ||
    reviewersError ||
    assignmentsError ||
    reviewsError ||
    summaryError ||
    summaryPublicError
  ) {
    throw (
      cycleError ||
      reviewersError ||
      assignmentsError ||
      reviewsError ||
      summaryError ||
      summaryPublicError
    );
  }

  const reviewerOptions = ((reviewersRaw ?? []) as any[])
    .filter((row) => row.id !== employeeId)
    .map((row) => ({
      id: row.id as string,
      fullName: one(row.profiles)?.full_name ?? "Unnamed reviewer",
      email: one(row.profiles)?.email ?? null,
      jobRoleId: one(row.job_roles)?.id ?? null,
      jobRoleName: one(row.job_roles)?.name ?? null,
    }));

  const assignments = ((assignmentsRaw ?? []) as any[]).map((row) => ({
    id: row.id as string,
    reviewerId: row.reviewer_id as string,
    reviewerType: row.reviewer_type as "primary" | "self" | "secondary" | "peer",
    isRequired: row.is_required as boolean,
    reviewerName: one(row.profiles)?.full_name ?? "Unknown reviewer",
    reviewerEmail: one(row.profiles)?.email ?? null,
  }));

  const primaryAssignments = assignments.filter((a) => a.reviewerType === "primary");
  const hasInvalidPrimaryAssignmentState = primaryAssignments.length !== 1;

  const reviews = ((reviewsRaw ?? []) as any[]).map((row) => ({
    id: row.id as string,
    assignmentId: row.assignment_id as string,
    reviewerId: row.reviewer_id as string,
    reviewerType: row.reviewer_type as "primary" | "self" | "secondary" | "peer",
    reviewerName: one(row.profiles)?.full_name ?? "Unknown reviewer",
    reviewerEmail: one(row.profiles)?.email ?? null,
    status: row.status as "draft" | "submitted" | "finalized",
    summaryEmployeeVisible: row.summary_employee_visible as string | null,
    narrativeShareWithEmployee: Boolean(row.narrative_share_with_employee),
    submittedAt: row.submitted_at as string | null,
    finalizedAt: row.finalized_at as string | null,
    updatedAt: row.updated_at as string,
  }));

  const reviewIds = ((reviewsRaw ?? []) as any[]).map((r) => r.id);

  let reviewScoresRaw: any[] = [];

  if (reviewIds.length > 0) {
    const { data, error } = await supabase
      .from("review_scores")
      .select(
        "review_id, category_scores, base_score, calibration_adjustment, final_score"
      )
      .in("review_id", reviewIds);

    if (error) throw error;

    reviewScoresRaw = data ?? [];
  }

  const reviewScoreByReviewId = new Map<string, any>(
    reviewScoresRaw.map((row) => [row.review_id, row])
  );

  const selfReview = reviews.find((r) => r.reviewerType === "self") ?? null;

  const primaryReviews = reviews.filter((r) => r.reviewerType === "primary");
  const primaryReview = primaryReviews[0] ?? null;
  const hasInvalidPrimaryState = primaryReviews.length !== 1;

  const secondaryReview = reviews.find((r) => r.reviewerType === "secondary") ?? null;
  const peerReviews = reviews.filter((r) => r.reviewerType === "peer");

  const selfSubmitted = Boolean(
    selfReview && (selfReview.status === "submitted" || selfReview.status === "finalized")
  );

  const primarySubmitted = Boolean(
    primaryReview && (primaryReview.status === "submitted" || primaryReview.status === "finalized")
  );

  const primaryScore = primaryReview ? reviewScoreByReviewId.get(primaryReview.id) : null;

  const hasPrimaryCategoryScores = Boolean(
    primaryScore &&
      primaryScore.category_scores &&
      typeof primaryScore.category_scores === "object" &&
      Object.keys(primaryScore.category_scores).length > 0
  );

    let scorePreview = {
    baseScore: primaryScore?.base_score ?? null,
    finalScore: primaryScore?.final_score ?? null,
    performanceRating:
      summaryRaw?.performance_rating ?? summaryPublicRaw?.performance_rating ?? null,
  };

  if (primarySubmitted && primaryScore?.category_scores) {
    const { data: previewRow, error: previewError } = await supabase
      .rpc("admin_preview_employee_cycle_summary", {
        p_cycle_id: selectedCycleId,
        p_employee_id: employeeId,
        p_calibration_adjustment: 0,
      })
      .single();

    if (previewError) throw previewError;

    scorePreview = {
      baseScore: previewRow?.base_score ?? scorePreview.baseScore,
      finalScore: previewRow?.final_score ?? scorePreview.finalScore,
      performanceRating:
        previewRow?.performance_rating ?? scorePreview.performanceRating,
    };
  }

  const finalized = Boolean(summaryRaw?.finalized_at || summaryPublicRaw?.finalized_at);
  const released = Boolean(summaryPublicRaw?.released_at);

  const canFinalize =
    !released &&
    !hasInvalidPrimaryState &&
    !hasInvalidPrimaryAssignmentState &&
    selfSubmitted &&
    primarySubmitted &&
    hasPrimaryCategoryScores;

  const state = released
    ? { label: "Released", tone: "success" as const }
    : finalized
      ? { label: "Finalized", tone: "neutral" as const }
      : selfSubmitted && primarySubmitted
        ? { label: "Ready to finalize", tone: "warm" as const }
        : { label: "Needs review", tone: "warm" as const };

  const suggestedFinalNarrative =
    (
      reviews
        .filter(
          (review) =>
            review.narrativeShareWithEmployee &&
            typeof review.summaryEmployeeVisible === "string" &&
            review.summaryEmployeeVisible.trim().length > 0
        )
        .sort((a, b) => {
          const order = { primary: 1, self: 2, secondary: 3, peer: 4 } as const;
          return (order[a.reviewerType] ?? 99) - (order[b.reviewerType] ?? 99);
        })
        .map((review) => {
          const label =
            review.reviewerType === "primary"
              ? "Primary review"
              : review.reviewerType === "self"
                ? "Self review"
                : review.reviewerType === "secondary"
                  ? "Secondary review"
                  : "Peer review";

          return `${label}:\n${review.summaryEmployeeVisible?.trim()}`;
        })
        .join("\n\n")
    ) || "";

  let finalizeDisabledReason: string | null = null;

  if (released) {
    finalizeDisabledReason = "Released reviews are locked.";
  } else if (hasInvalidPrimaryAssignmentState || hasInvalidPrimaryState) {
    finalizeDisabledReason = "Finalization requires exactly one active primary reviewer.";
  } else if (!selfSubmitted || !primarySubmitted) {
    finalizeDisabledReason = "Finalization requires submitted self and primary reviews.";
  } else if (!hasPrimaryCategoryScores) {
    finalizeDisabledReason = "Finalization requires completed primary review scores.";
  }

  const finalNarrative =
    summaryRaw?.final_narrative_employee_visible ||
    summaryPublicRaw?.final_narrative_employee_visible ||
    suggestedFinalNarrative;

  const canRelease =
    !released &&
    finalized &&
    !hasInvalidPrimaryState &&
    !hasInvalidPrimaryAssignmentState &&
    Boolean(finalNarrative?.trim());

  let releaseDisabledReason: string | null = null;

  if (hasInvalidPrimaryAssignmentState || hasInvalidPrimaryState) {
    releaseDisabledReason = "Release requires exactly one active primary reviewer.";
  } else if (!selfSubmitted || !primarySubmitted) {
    releaseDisabledReason = "Release requires submitted self and primary reviews.";
  } else if (!hasPrimaryCategoryScores) {
    releaseDisabledReason = "Release requires completed primary review scores.";
  } else if (!finalized) {
    releaseDisabledReason = "Release requires finalization first.";
  } else if (!finalNarrative?.trim()) {
    releaseDisabledReason = "Release requires a finalized narrative.";
  }

  return {
    user,
    selectedCycleId,
    cycleId: selectedCycleId,
    cycleLabel: cycleRow?.name ?? "Active cycle",
    cycleRow,
    employeeRow,
    employee,
    employeeName,
    employeeEmail,
    employeeCode,
    employeeHireDate,
    jobRoleName,
    employeeJobRoleId,
    reviewerOptions,
    assignments,
    reviews,
    selfReview,
    primaryReview,
    secondaryReview,
    peerReviews,
    reviewScoreByReviewId,
    primaryScore,
    selfSubmitted,
    primarySubmitted,
    hasPrimaryCategoryScores,
    finalized,
    released,
    canFinalize,
    canRelease,
    finalizeDisabledReason,
    releaseDisabledReason,
    summaryRaw: summaryRaw as any,
    summaryPublicRaw: summaryPublicRaw as any,
    suggestedFinalNarrative,
    initialNarrative: finalNarrative ?? "",
    initialCalibrationReason: summaryRaw?.calibration_reason ?? "",
    initialCalibrationAdjustment: primaryScore?.calibration_adjustment ?? 0,
    initialFinalizedAt: summaryRaw?.finalized_at ?? summaryPublicRaw?.finalized_at ?? null,
    initialReleasedAt: summaryPublicRaw?.released_at ?? null,
    scorePreview,
    state,
  };
}