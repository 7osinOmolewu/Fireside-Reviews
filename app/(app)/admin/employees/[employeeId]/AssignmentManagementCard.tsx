"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ReviewerOption = {
  id: string;
  fullName: string;
  email: string | null;
  jobRoleId: string | null;
  jobRoleName: string | null;
};

type AssignmentVm = {
  id: string;
  reviewerId: string;
  reviewerType: "primary" | "self" | "secondary" | "peer";
  isRequired: boolean;
  reviewerName: string;
  reviewerEmail: string | null;
};

type Props = {
  cycleId: string;
  employeeId: string;
  employeeName: string;
  employeeJobRoleId: string | null;
  reviewerOptions: ReviewerOption[];
  assignments: AssignmentVm[];
  released: boolean;
};

type FormState = {
  primaryReviewerId: string;
  secondaryReviewerId: string;
  peerReviewerIds: string[];
};

export function AssignmentManagementCard({
  cycleId,
  employeeId,
  employeeName,
  employeeJobRoleId,
  reviewerOptions,
  assignments,
  released,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialState = useMemo<FormState>(() => {
    const primaryReviewerId =
      assignments.find((a) => a.reviewerType === "primary")?.reviewerId ?? "";
    const secondaryReviewerId =
      assignments.find((a) => a.reviewerType === "secondary")?.reviewerId ?? "";
    const peerReviewerIds = assignments
      .filter((a) => a.reviewerType === "peer")
      .map((a) => a.reviewerId);

    return {
      primaryReviewerId,
      secondaryReviewerId,
      peerReviewerIds,
    };
  }, [assignments]);

  const [formState, setFormState] = useState<FormState>(initialState);

  const currentPrimary =
    assignments.find((a) => a.reviewerType === "primary")?.reviewerName ?? "None";
  const currentSecondary =
    assignments.find((a) => a.reviewerType === "secondary")?.reviewerName ?? "None";
  const currentPeers =
    assignments.filter((a) => a.reviewerType === "peer").map((a) => a.reviewerName).join(", ") ||
    "None";

  const peerReviewerOptions = reviewerOptions.filter(
    (reviewer) => reviewer.jobRoleId && reviewer.jobRoleId === employeeJobRoleId
  );

  function setPrimary(reviewerId: string) {
    setFormState((prev) => ({
      ...prev,
      primaryReviewerId: reviewerId,
      peerReviewerIds: prev.peerReviewerIds.filter((id) => id !== reviewerId),
      secondaryReviewerId:
        prev.secondaryReviewerId === reviewerId ? "" : prev.secondaryReviewerId,
    }));
  }

  function setSecondary(reviewerId: string) {
    setFormState((prev) => ({
      ...prev,
      secondaryReviewerId: reviewerId,
      peerReviewerIds: prev.peerReviewerIds.filter((id) => id !== reviewerId),
      primaryReviewerId:
        prev.primaryReviewerId === reviewerId ? "" : prev.primaryReviewerId,
    }));
  }

  function togglePeer(reviewerId: string) {
    setFormState((prev) => {
      const alreadySelected = prev.peerReviewerIds.includes(reviewerId);
      const nextPeerReviewerIds = alreadySelected
        ? prev.peerReviewerIds.filter((id) => id !== reviewerId)
        : [...prev.peerReviewerIds, reviewerId];

      return {
        ...prev,
        peerReviewerIds: nextPeerReviewerIds,
        primaryReviewerId:
          prev.primaryReviewerId === reviewerId ? "" : prev.primaryReviewerId,
        secondaryReviewerId:
          prev.secondaryReviewerId === reviewerId ? "" : prev.secondaryReviewerId,
      };
    });
  }

  async function saveAssignments() {
    if (!formState.primaryReviewerId) {
      setError("Primary reviewer is required.");
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const res = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycleId,
          employeeId,
          primaryReviewerId: formState.primaryReviewerId,
          secondaryReviewerId: formState.secondaryReviewerId || null,
          peerReviewerIds: formState.peerReviewerIds,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error ?? "Failed to save assignments.");
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (e: any) {
      setError(e?.message ?? "Failed to save assignments.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-orange-100/70 bg-[#fffdfb] p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-slate-900">Assignment Management</div>
          <div className="mt-1 text-sm text-slate-600">
            Configure primary, secondary, and peer reviewers for {employeeName}.
          </div>
        </div>

        {released ? (
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            Locked after release
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Primary
          </div>
          <div className="rounded-2xl border border-orange-100 bg-white p-3 shadow-sm">
            <select
              value={formState.primaryReviewerId}
              onChange={(e) => setPrimary(e.target.value)}
              disabled={released}
              className="w-full rounded-xl border border-orange-100 bg-[#fffdfb] px-3 py-2 text-sm text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option value="">Select reviewer</option>
              {reviewerOptions.map((reviewer) => (
                <option key={reviewer.id} value={reviewer.id}>
                  {reviewer.fullName}
                </option>
              ))}
            </select>

            <div className="mt-3 text-xs text-slate-500">
              Current: <span className="font-medium text-slate-700">{currentPrimary}</span>
            </div>
          </div>
        </div>

        <div className="xl:col-span-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Secondary
          </div>
          <div className="rounded-2xl border border-orange-100 bg-white p-3 shadow-sm">
            <select
              value={formState.secondaryReviewerId}
              onChange={(e) => setSecondary(e.target.value)}
              disabled={released}
              className="w-full rounded-xl border border-orange-100 bg-[#fffdfb] px-3 py-2 text-sm text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option value="">None</option>
              {reviewerOptions.map((reviewer) => (
                <option key={reviewer.id} value={reviewer.id}>
                  {reviewer.fullName}
                </option>
              ))}
            </select>

            <div className="mt-3 text-xs text-slate-500">
              Current: <span className="font-medium text-slate-700">{currentSecondary}</span>
            </div>
          </div>
        </div>

        <div className="xl:col-span-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Peer reviewers
          </div>
          <div className="rounded-2xl border border-orange-100 bg-white p-3 shadow-sm">
            <div className="grid max-h-40 gap-2 overflow-auto pr-1">
              {peerReviewerOptions.map((reviewer) => {
                const checked = formState.peerReviewerIds.includes(reviewer.id);

                return (
                  <label
                    key={reviewer.id}
                    className="flex items-center gap-2 rounded-xl border border-transparent px-2 py-1.5 text-sm text-slate-700 hover:border-orange-100 hover:bg-[#fff7f0]/50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={released}
                      onChange={() => togglePeer(reviewer.id)}
                      className="h-4 w-4"
                    />
                    <span className="truncate">{reviewer.fullName}</span>
                  </label>
                );
              })}
            </div>

            <div className="mt-3 text-xs text-slate-500">
              Current: <span className="font-medium text-slate-700">{currentPeers}</span>
            </div>
          </div>
        </div>

        <div className="xl:col-span-2">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Self
          </div>
          <div className="rounded-2xl border border-orange-100 bg-white p-3 shadow-sm">
            <div className="rounded-xl border border-orange-100 bg-[#fffdfb] px-3 py-2 text-sm text-slate-900">
              {employeeName}
            </div>

            <div className="mt-3 text-xs text-slate-500">Automatically assigned</div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-orange-100 pt-4">
        <button
          type="button"
          onClick={saveAssignments}
          disabled={released || isSaving}
          className={
            released || isSaving
              ? "inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-400 shadow-sm"
              : "inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          }
        >
          {isSaving ? "Saving..." : "Save assignments"}
        </button>

        {isPending ? <div className="text-xs text-slate-500">Refreshing…</div> : null}
      </div>

      {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
    </section>
  );
}