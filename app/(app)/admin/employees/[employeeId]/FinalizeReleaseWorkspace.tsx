"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  cycleId: string;
  employeeId: string;
  initialNarrative: string;
  initialCalibrationReason: string;
  initialCalibrationAdjustment: number;
  initialFinalizedAt: string | null;
  initialReleasedAt: string | null;
  canFinalize: boolean;
  canRelease: boolean;
  finalizeDisabledReason: string | null;
  releaseDisabledReason: string | null;
  scorePreview: {
    baseScore: number | null;
    finalScore: number | null;
    performanceRating: string | null;
  };
};

export function FinalizeReleaseWorkspace({
  cycleId,
  employeeId,
  initialNarrative,
  initialCalibrationReason,
  initialCalibrationAdjustment,
  initialFinalizedAt,
  initialReleasedAt,
  canFinalize,
  canRelease,
  finalizeDisabledReason,
  releaseDisabledReason,
  scorePreview,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [finalNarrative, setFinalNarrative] = useState(initialNarrative);
  const [calibrationAdjustment, setCalibrationAdjustment] = useState(
    String(initialCalibrationAdjustment)
  );
  const calibrationDelta = Number(calibrationAdjustment || 0);

  const previewBaseScore =
    typeof scorePreview?.baseScore === "number"
        ? scorePreview.baseScore
        : null;

  const previewFinalScore =
    previewBaseScore !== null
        ? Math.max(0, Math.min(100, previewBaseScore + calibrationDelta))
        : typeof scorePreview?.finalScore === "number"
        ? scorePreview.finalScore
        : null;

  const [calibrationReason, setCalibrationReason] = useState(initialCalibrationReason);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const isReleased = useMemo(() => Boolean(initialReleasedAt), [initialReleasedAt]);
  const finalizationLocked = isReleased;

  async function saveFinalization() {
    setError(null);
    setStatus(null);

    const adj = Number(calibrationAdjustment);

    if (!Number.isInteger(adj)) {
      setError("Calibration adjustment must be a whole number.");
      return;
    }

    if (adj < -5 || adj > 5) {
      setError("Calibration adjustment must be between -5 and 5.");
      return;
    }

    if (!finalNarrative.trim()) {
      setError("Final narrative is required.");
      return;
    }

    if (adj !== 0 && !calibrationReason.trim()) {
      setError("Calibration reason is required when adjustment is non-zero.");
      return;
    }

    setStatus(initialFinalizedAt ? "Updating finalization..." : "Saving finalization...");

    try {
      const res = await fetch("/api/admin/finalize-employee-cycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycleId,
          employeeId,
          finalNarrative: finalNarrative.trim(),
          calibrationAdjustment: adj,
          calibrationReason: calibrationReason.trim(),
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to finalize summary.");

      setStatus("Finalization saved ✓");
      startTransition(() => router.refresh());
    } catch (e: any) {
      setError(e?.message ?? "Failed to finalize summary.");
      setStatus(null);
    }
  }

  async function releaseToEmployee() {
    setError(null);
    setStatus(null);

    if (!canRelease || isReleased) return;

    const ok = window.confirm(
      "Release this finalized review to the employee? This will make the evaluation visible on their employee page."
    );
    if (!ok) return;

    setStatus("Releasing...");

    try {
      const res = await fetch("/api/admin/release-employee-cycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId, employeeId }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Release failed.");

      setStatus("Released ✓");
      startTransition(() => router.refresh());
    } catch (e: any) {
      setError(e?.message ?? "Release failed.");
      setStatus(null);
    }
  }

  return (
    <section className="rounded-2xl border border-orange-100/70 bg-[#fffdfb] p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-slate-900">Finalize / Release</div>
          <div className="mt-1 text-sm text-slate-600">
            Review the final narrative, apply calibration if needed, and release when ready.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {initialFinalizedAt ? (
            <span className="inline-flex items-center rounded-full border border-orange-200 bg-[#fff7f0] px-3 py-1 text-xs font-semibold text-slate-700">
              Finalized
            </span>
          ) : null}
          {initialReleasedAt ? (
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Released
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Final employee narrative
          </div>

          <textarea
            value={finalNarrative}
            onChange={(e) => setFinalNarrative(e.target.value)}
            rows={12}
            disabled={finalizationLocked}
            className="mt-3 w-full rounded-xl border border-orange-100 bg-[#fffdfb] px-3 py-3 text-sm leading-6 text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            placeholder="Enter the final employee-visible review narrative."
          />
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              Calibration
            </div>

            <div className="mt-3">
              <label className="text-sm font-medium text-slate-800">Adjustment</label>
              <input
                type="number"
                min={-5}
                max={5}
                step={1}
                value={calibrationAdjustment}
                onChange={(e) => setCalibrationAdjustment(e.target.value)}
                disabled={finalizationLocked}
                className="mt-2 w-full rounded-xl border border-orange-100 bg-[#fffdfb] px-3 py-2 text-sm text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
              />
              <div className="mt-2 text-xs text-slate-500">Allowed range: -5 to 5</div>
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium text-slate-800">Reason</label>
              <textarea
                value={calibrationReason}
                onChange={(e) => setCalibrationReason(e.target.value)}
                rows={4}
                disabled={finalizationLocked}
                className="mt-2 w-full rounded-xl border border-orange-100 bg-[#fffdfb] px-3 py-3 text-sm leading-6 text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Required if adjustment is non-zero."
               />
            </div>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              Score preview
            </div>

            <div className="mt-3 space-y-2 text-sm text-slate-700">
            
            <div className="mt-2 space-y-1 text-sm text-slate-700">
            <div>
                Base score: {previewBaseScore !== null ? previewBaseScore.toFixed(1) : "Pending primary review"}
            </div>
            <div>
                Rating: {scorePreview?.performanceRating ?? "Not available yet"}
            </div>
            <div>
                Final score: {previewFinalScore !== null ? previewFinalScore.toFixed(1) : "Pending"}
            </div>
          </div>
         </div>
        </div>

          <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveFinalization}
                disabled={isPending || !canFinalize || finalizationLocked}
                className={
                  isPending || !canFinalize
                    ? "inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-400 shadow-sm"
                    : "inline-flex h-10 items-center justify-center rounded-xl border border-orange-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm hover:bg-orange-50"
                }
              >
                Save Finalization
              </button>

              <button
                type="button"
                onClick={releaseToEmployee}
                disabled={isPending || !canRelease || isReleased}
                className={
                  isPending || !canRelease || isReleased
                    ? "inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-400 shadow-sm"
                    : "inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90"
                }
              >
                {isReleased ? "Released" : "Release to Employee"}
              </button>
            </div>

            {finalizationLocked ? (
                <div className="mt-3 text-xs text-slate-500">
                    Released reviews are locked. Recall support is not yet implemented.
                </div>
            ) : !canFinalize && finalizeDisabledReason ? (
                <div className="mt-3 text-xs text-slate-500">{finalizeDisabledReason}</div>
            ) : !canRelease && !isReleased && releaseDisabledReason ? (
                <div className="mt-3 text-xs text-slate-500">{releaseDisabledReason}</div>
            ) : null}

            {status ? <div className="mt-3 text-sm text-slate-600">{status}</div> : null}
            {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}