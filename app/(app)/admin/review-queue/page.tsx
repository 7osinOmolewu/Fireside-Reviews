import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { FinalizeReleaseWorkspace } from "@/app/(app)/admin/employees/[employeeId]/FinalizeReleaseWorkspace";
import { ReviewQueueNav } from "./ReviewQueueNav";
import {
  getEmployeeReviewWorkspaceData,
  normalizeEmployeeIds,
} from "@/lib/admin/getEmployeeReviewWorkspaceData";

type Props = {
  searchParams?: Promise<{
    employeeIds?: string;
    index?: string;
  }>;
};

export default async function ReviewQueuePage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const employeeIds = normalizeEmployeeIds(params.employeeIds);
  const rawIndex = Number(params.index ?? "0");
  const safeIndex = Number.isFinite(rawIndex) ? rawIndex : 0;

  if (employeeIds.length === 0) {
    redirect("/admin/assignments");
  }

  const boundedIndex = Math.min(Math.max(safeIndex, 0), employeeIds.length - 1);
  const currentEmployeeId = employeeIds[boundedIndex];

  if (!currentEmployeeId) {
    notFound();
  }

  const data = await getEmployeeReviewWorkspaceData(currentEmployeeId);

    if (!data.cycleId) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-stone-200 bg-[#fffdfb] p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-stone-500">No active cycle</p>
              <h1 className="text-2xl font-semibold text-stone-900">Bulk review processing</h1>
              <p className="text-sm text-stone-600">
                Set a global active cycle before processing employee reviews.
              </p>
            </div>

            <Link
              href="/admin/assignments"
              className="inline-flex rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700"
            >
              Back to review operations
            </Link>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-stone-200 bg-[#fffdfb] p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-stone-500">{data.cycleLabel}</p>
            <h1 className="text-2xl font-semibold text-stone-900">Bulk review processing</h1>
            <p className="text-sm text-stone-600">
              Process each employee in a calm, linear workflow.
            </p>
          </div>

          <Link
            href="/admin/assignments"
            className="inline-flex rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700"
          >
            Back to review operations
          </Link>
        </div>
      </div>

      <ReviewQueueNav employeeIds={employeeIds} currentIndex={boundedIndex} />

      <div className="rounded-2xl border border-stone-200 bg-[#fffdfb] p-6 shadow-sm">
        <div className="space-y-1">
          <p className="text-sm font-medium text-stone-500">Current employee</p>
          <h2 className="text-xl font-semibold text-stone-900">
            {data.employee.profiles?.full_name ?? "Employee"}
          </h2>
          <p className="text-sm text-stone-600">
            {data.employee.job_roles?.name ?? "No job family"}
          </p>
        </div>
      </div>

      <FinalizeReleaseWorkspace
        cycleId={data.cycleId}
        employeeId={data.employee.id}
        initialNarrative={data.initialNarrative}
        initialCalibrationReason={data.initialCalibrationReason}
        initialCalibrationAdjustment={data.initialCalibrationAdjustment}
        initialFinalizedAt={data.initialFinalizedAt}
        initialReleasedAt={data.initialReleasedAt}
        canFinalize={data.canFinalize}
        canRelease={data.canRelease}
        finalizeDisabledReason={data.finalizeDisabledReason}
        releaseDisabledReason={data.releaseDisabledReason}
        scorePreview={data.scorePreview}
      />

      <ReviewQueueNav employeeIds={employeeIds} currentIndex={boundedIndex} />
    </div>
  );
}