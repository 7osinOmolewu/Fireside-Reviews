import Link from "next/link";
import { PageHeader } from "@/app/_components/page-header";
import { AdminReopenReviewButton } from "@/app/_components/AdminReopenReviewButton";
import { ProcessingSummaryBar } from "./ProcessingSummaryBar";
import { FinalizeReleaseWorkspace } from "./FinalizeReleaseWorkspace";
import { AssignmentManagementCard } from "./AssignmentManagementCard";
import { getEmployeeReviewWorkspaceData } from "@/lib/admin/getEmployeeReviewWorkspaceData";

type PageProps = {
  params: Promise<{
    employeeId: string;
  }>;
};

function badgeClass(tone: "warm" | "neutral" | "success") {
  if (tone === "success") {
    return "inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700";
  }

  if (tone === "neutral") {
    return "inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600";
  }

  return "inline-flex items-center rounded-full border border-orange-200 bg-[#fff7f0] px-3 py-1 text-xs font-semibold text-slate-700";
}

function canReopenReview(
  review: { id: string; status: "draft" | "submitted" | "finalized" } | null,
  released: boolean
) {
  if (!review) return false;
  if (released) return false;
  return review.status === "submitted" || review.status === "finalized";
}

export default async function AdminEmployeeReviewPage({ params }: PageProps) {
  const { employeeId } = await params;

  const {
    selectedCycleId,
    cycleRow,
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
    selfSubmitted,
    primarySubmitted,
    finalized,
    released,
    canFinalize,
    canRelease,
    finalizeDisabledReason,
    releaseDisabledReason,
    summaryRaw,
    summaryPublicRaw,
    suggestedFinalNarrative,
    scorePreview,
    state,
  } = await getEmployeeReviewWorkspaceData(employeeId);

  if (!selectedCycleId) {
    return (
      <>
        <PageHeader
          title="Employee Review"
          description="Review processing workspace"
        />

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Link href="/admin/assignments" className="hover:underline">
              Review Operations
            </Link>
            <span>›</span>
            <span className="text-slate-900">{employeeName}</span>
          </div>

          <div className="rounded-2xl border border-orange-100/70 bg-[#fff7f0]/70 p-5 shadow-sm">
            <div className="text-base font-semibold text-slate-900">No active cycle</div>
            <div className="mt-2 text-sm text-slate-600">
              Set a global active cycle before processing employee reviews.
            </div>
          </div>
        </div>
      </>
    );
  }

  function ReviewCard({
    title,
    review,
  }: {
    title: string;
    review: (typeof reviews)[number] | null;
  }) {
    if (!review) {
      return (
        <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="mt-2 text-sm text-slate-600">No active review record.</div>
        </div>
      );
    }

    const score = reviewScoreByReviewId.get(review.id);
    const canReopen = canReopenReview(review, released);

    return (
      <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">{title}</div>
            <div className="mt-1 text-sm text-slate-700">{review.reviewerName}</div>
            {review.reviewerEmail ? (
              <div className="text-xs text-slate-500">{review.reviewerEmail}</div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-orange-200 bg-[#fff7f0] px-2.5 py-1 text-xs font-semibold text-slate-700">
              {review.status}
            </span>
            <span
              className={
                review.narrativeShareWithEmployee
                  ? "inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                  : "inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600"
              }
            >
              {review.narrativeShareWithEmployee ? "Visible to employee" : "Hidden from employee"}
            </span>

            <AdminReopenReviewButton
              reviewId={review.id}
              disabled={!canReopen}
              title={
                !canReopen
                  ? released
                    ? "Cannot reopen after release"
                    : "Only submitted or finalized reviews can be reopened"
                  : "Reopen this review"
              }
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-1">
          <div className="rounded-xl border border-orange-100 bg-[#fffdfb] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              Timing
            </div>
            <div className="mt-2 space-y-1 text-sm text-slate-700">
              <div>Submitted: {review.submittedAt ?? "—"}</div>
              <div>Finalized: {review.finalizedAt ?? "—"}</div>
              <div>Updated: {review.updatedAt ?? "—"}</div>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-orange-100 bg-[#fffdfb] p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Narrative
          </div>
          <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">
            {review.summaryEmployeeVisible || "No narrative provided."}
          </div>
        </div>

        {review.reviewerType === "primary" && score?.category_scores ? (
          <div className="mt-4 rounded-xl border border-orange-100 bg-[#fffdfb] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              Category scores
            </div>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-700">
              {JSON.stringify(score.category_scores, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Employee Review"
        description="Review processing workspace for the active cycle."
      />

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Link href="/admin/assignments" className="hover:underline">
            Review Operations
          </Link>
          <span>›</span>
          <span className="text-slate-900">{employeeName}</span>
        </div>

        <section className="rounded-2xl border border-orange-100/70 bg-[#fff7f0]/70 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="text-lg font-semibold text-slate-900">{employeeName}</div>
              <div className="text-sm text-slate-600">
                {jobRoleName ?? "No role"} {employeeCode ? `• ${employeeCode}` : ""}
              </div>
              {employeeEmail ? <div className="text-sm text-slate-600">{employeeEmail}</div> : null}
              {employeeHireDate ? (
                <div className="text-xs text-slate-500">Hire date: {employeeHireDate}</div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                Cycle: {cycleRow?.name ?? "Active cycle"}
              </span>
              <span className={badgeClass(state.tone)}>{state.label}</span>
            </div>
          </div>
        </section>

       <nav className="rounded-2xl border border-orange-100/70 bg-[#fffdfb] p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
            <a
            href="#assignment-management"
            className="group rounded-2xl border border-orange-200 bg-[#fff7f0] p-4 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
            >
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-orange-200 bg-white text-lg shadow-sm">
                📝
                </div>

                <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">
                    Assign Review Forms
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-600">
                    Configure primary, secondary, and peer reviewers.
                </div>
                </div>
            </div>
            </a>

            <a
            href="#finalize-release"
            className="group rounded-2xl border border-orange-200 bg-[#fff7f0] p-4 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
            >
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-orange-200 bg-white text-lg shadow-sm">
                ✅
                </div>

                <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">
                    Finalize & Release
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-600">
                    Save final narrative, calibrate if needed, and release.
                </div>
                </div>
            </div>
            </a>

            <a
            href="#final-summary"
            className="group rounded-2xl border border-orange-200 bg-[#fff7f0] p-4 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
            >
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-orange-200 bg-white text-lg shadow-sm">
                📊
                </div>

                <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">
                    Final Summary
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-600">
                    Review the final outcome and expand supporting inputs.
                </div>
                </div>
            </div>
            </a>
        </div>
        </nav>
        <ProcessingSummaryBar
          selfSubmitted={selfSubmitted}
          primarySubmitted={primarySubmitted}
          peerCompleted={
            peerReviews.filter((r) => r.status === "submitted" || r.status === "finalized").length
          }
          peerTotal={assignments.filter((a) => a.reviewerType === "peer").length}
          finalized={finalized}
          released={released}
        />

        <div id="assignment-management" className="scroll-mt-24">
          <AssignmentManagementCard
            cycleId={selectedCycleId}
            employeeId={employeeId}
            employeeName={employeeName}
            employeeJobRoleId={employeeJobRoleId}
            reviewerOptions={reviewerOptions}
            assignments={assignments}
            released={released}
          />
        </div>

        <div id="finalize-release" className="scroll-mt-24">
          <FinalizeReleaseWorkspace
            cycleId={selectedCycleId}
            employeeId={employeeId}
            initialNarrative={
              summaryRaw?.final_narrative_employee_visible ||
              summaryPublicRaw?.final_narrative_employee_visible ||
              suggestedFinalNarrative
            }
            initialCalibrationReason={summaryRaw?.calibration_reason ?? ""}
            initialCalibrationAdjustment={0}
            initialFinalizedAt={summaryRaw?.finalized_at ?? summaryPublicRaw?.finalized_at ?? null}
            initialReleasedAt={summaryPublicRaw?.released_at ?? null}
            canFinalize={canFinalize}
            canRelease={canRelease}
            finalizeDisabledReason={finalizeDisabledReason}
            releaseDisabledReason={releaseDisabledReason}
            scorePreview={scorePreview}
          />
        </div>

        <section
          id="final-summary"
          className="scroll-mt-24 rounded-2xl border border-orange-100/70 bg-[#fffdfb] p-5 shadow-sm"
        >
          <div className="mb-4 text-base font-semibold text-slate-900">Final Summary</div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Internal Summary
              </div>

              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <div>Performance rating: {summaryRaw?.performance_rating ?? "—"}</div>
                <div>Primary final score: {summaryRaw?.primary_final_score ?? "—"}</div>
                <div>Calibration reason: {summaryRaw?.calibration_reason ?? "—"}</div>
                <div>Finalized at: {summaryRaw?.finalized_at ?? "—"}</div>
                <div>Computed at: {summaryRaw?.computed_at ?? "—"}</div>
              </div>

              <div className="mt-4 rounded-xl border border-orange-100 bg-[#fffdfb] p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Final narrative
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                  {summaryRaw?.final_narrative_employee_visible || "No final narrative."}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Employee-Released Summary
              </div>

              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <div>Performance rating: {summaryPublicRaw?.performance_rating ?? "—"}</div>
                <div>Rating value: {summaryPublicRaw?.performance_rating_value ?? "—"}</div>
                <div>Finalized at: {summaryPublicRaw?.finalized_at ?? "—"}</div>
                <div>Released at: {summaryPublicRaw?.released_at ?? "—"}</div>
                <div>Released by: {summaryPublicRaw?.released_by ?? "—"}</div>
              </div>

              <div className="mt-4 rounded-xl border border-orange-100 bg-[#fffdfb] p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Released narrative
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                  {summaryPublicRaw?.final_narrative_employee_visible || "No released narrative."}
                </div>
              </div>
            </div>
          </div>

          <details className="mt-5 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-slate-900">
                    Supporting Review Inputs
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Expand to inspect the review narratives, timing, scores, and reopen controls.
                  </div>
                </div>

                <span className="inline-flex items-center rounded-full border border-orange-200 bg-[#fff7f0] px-3 py-1 text-xs font-semibold text-slate-700">
                  Expand
                </span>
              </div>
            </summary>

            <div className="mt-4 space-y-4 border-t border-orange-100 pt-4">
              <ReviewCard title="Primary Review" review={primaryReview} />
              <ReviewCard title="Self Review" review={selfReview} />
              <ReviewCard title="Secondary Review" review={secondaryReview} />

              {peerReviews.length > 0 ? (
                <div className="space-y-4">
                  {peerReviews.map((review, index) => (
                    <ReviewCard
                      key={review.id}
                      title={`Peer Review ${index + 1}`}
                      review={review}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </details>
        </section>
      </div>
    </>
  );
}