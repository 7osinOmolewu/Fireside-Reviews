"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type EmployeeVm = {
  id: string;
  fullName: string;
  email: string | null;
  employeeCode: string | null;
  jobRoleName: string | null;
  jobRoleCode: string | null;
};

type AssignmentVm = {
  id: string;
  employeeId: string;
  reviewerId: string;
  reviewerType: "primary" | "self" | "secondary" | "peer";
  isRequired: boolean;
  isActive: boolean;
  reviewerName: string;
  reviewerEmail: string | null;
};

type ReviewVm = {
  id: string;
  assignmentId: string;
  employeeId: string;
  reviewerType: "primary" | "self" | "secondary" | "peer";
  status: "draft" | "submitted" | "finalized";
};

type InternalSummaryVm = {
  employeeId: string;
  finalizedAt: string | null;
};

type PublicSummaryVm = {
  employeeId: string;
  releasedAt: string | null;
};

type Props = {
  cycleId: string;
  cycleName: string;
  cycleStatus: string;
  employees: EmployeeVm[];
  assignments: AssignmentVm[];
  reviews: ReviewVm[];
  internalSummaries: InternalSummaryVm[];
  publicSummaries: PublicSummaryVm[];
};

type FilterValue = "all" | "needs_review" | "ready_to_finalize" | "finalized" | "released";

type EmployeeRowVm = {
  employeeId: string;
  employee: EmployeeVm;
  primaryReviewerName: string | null;
  selfSubmitted: boolean;
  primarySubmitted: boolean;
  peerCompleted: number;
  peerTotal: number;
  finalized: boolean;
  finalizedAt: string | null;
  released: boolean;
  releasedAt: string | null;
  stateLabel: string;
  stateTone: "warm" | "neutral" | "success";
};

function badgeClass(tone: "warm" | "neutral" | "success") {
  if (tone === "success") {
    return "inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700";
  }

  if (tone === "neutral") {
    return "inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600";
  }

  return "inline-flex items-center rounded-full border border-orange-200 bg-[#fff7f0] px-2.5 py-1 text-xs font-semibold text-slate-700";
}

function rowTint(row: EmployeeRowVm) {
  if (row.released) return "bg-emerald-50/40";
  if (row.stateLabel === "Ready to finalize") return "bg-orange-50/40";
  return "bg-[#fffdfb]";
}

export function ReviewOpsWorkbench({
  cycleId,
  cycleName,
  cycleStatus,
  employees,
  assignments,
  reviews,
  internalSummaries,
  publicSummaries,
}: Props) {

const [search, setSearch] = useState("");
const [filter, setFilter] = useState<FilterValue>("all");
const [selectedIds, setSelectedIds] = useState<string[]>([]);
const router = useRouter();
const [isPending, startTransition] = useTransition();
const [bulkError, setBulkError] = useState<string | null>(null);

  
  const activeAssignments = useMemo(
    () => assignments.filter((row) => row.isActive),
    [assignments]
  );

  const activeAssignmentIds = useMemo(
    () => new Set(activeAssignments.map((row) => row.id)),
    [activeAssignments]
  );

  const activeReviews = useMemo(
    () => reviews.filter((row) => activeAssignmentIds.has(row.assignmentId)),
    [reviews, activeAssignmentIds]
  );

  const assignmentMap = useMemo(() => {
    const map = new Map<string, AssignmentVm[]>();

    for (const row of activeAssignments) {
      const list = map.get(row.employeeId) ?? [];
      list.push(row);
      map.set(row.employeeId, list);
    }

    return map;
  }, [activeAssignments]);

  const reviewMap = useMemo(() => {
    const map = new Map<string, ReviewVm[]>();

    for (const row of activeReviews) {
      const list = map.get(row.employeeId) ?? [];
      list.push(row);
      map.set(row.employeeId, list);
    }

    return map;
  }, [activeReviews]);

  const finalizedMap = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const row of internalSummaries) {
      map.set(row.employeeId, row.finalizedAt);
    }
    return map;
  }, [internalSummaries]);

  const releasedMap = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const row of publicSummaries) {
      map.set(row.employeeId, row.releasedAt);
    }
    return map;
  }, [publicSummaries]);

  const rows = useMemo<EmployeeRowVm[]>(() => {
    return employees.map((employee) => {
      const employeeAssignments = assignmentMap.get(employee.id) ?? [];
      const employeeReviews = reviewMap.get(employee.id) ?? [];

      const primaryAssignment =
        employeeAssignments.find((row) => row.reviewerType === "primary") ?? null;

      const selfReview =
        employeeReviews.find((row) => row.reviewerType === "self") ?? null;

      const primaryReview =
        employeeReviews.find((row) => row.reviewerType === "primary") ?? null;

      const peerAssignments = employeeAssignments.filter((row) => row.reviewerType === "peer");
      const peerReviews = employeeReviews.filter((row) => row.reviewerType === "peer");
      const peerCompleted = peerReviews.filter(
        (row) => row.status === "submitted" || row.status === "finalized"
      ).length;

      const selfSubmitted =
        selfReview?.status === "submitted" || selfReview?.status === "finalized";

      const primarySubmitted =
        primaryReview?.status === "submitted" || primaryReview?.status === "finalized";

      const finalized = Boolean(finalizedMap.get(employee.id));
      const released = Boolean(releasedMap.get(employee.id));

      let stateLabel = "Needs review";
      let stateTone: "warm" | "neutral" | "success" = "warm";

      if (released) {
        stateLabel = "Released";
        stateTone = "success";
      } else if (finalized) {
        stateLabel = "Finalized";
        stateTone = "neutral";
      } else if (selfSubmitted && primarySubmitted) {
        stateLabel = "Ready to finalize";
        stateTone = "warm";
      } else if (selfSubmitted || primarySubmitted || peerCompleted > 0) {
        stateLabel = "In progress";
        stateTone = "warm";
      }

      return {
        employeeId: employee.id,
        employee,
        primaryReviewerName: primaryAssignment?.reviewerName ?? null,
        selfSubmitted,
        primarySubmitted,
        peerCompleted,
        peerTotal: peerAssignments.length,
        finalized,
        finalizedAt: finalizedMap.get(employee.id) ?? null,
        released,
        releasedAt: releasedMap.get(employee.id) ?? null,
        stateLabel,
        stateTone,
      };
    });
  }, [employees, assignmentMap, reviewMap, finalizedMap, releasedMap]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows
      .filter((row) => {
        if (!q) return true;

        return (
          row.employee.fullName.toLowerCase().includes(q) ||
          (row.employee.email ?? "").toLowerCase().includes(q) ||
          (row.employee.jobRoleName ?? "").toLowerCase().includes(q) ||
          (row.employee.employeeCode ?? "").toLowerCase().includes(q)
        );
      })
      .filter((row) => {
        switch (filter) {
          case "needs_review":
            return !row.finalized && !row.released;
          case "ready_to_finalize":
            return row.stateLabel === "Ready to finalize";
          case "finalized":
            return row.finalized && !row.released;
          case "released":
            return row.released;
          default:
            return true;
        }
      })
      .sort((a, b) => {
        const order = {
          "Needs review": 1,
          "In progress": 2,
          "Ready to finalize": 3,
          Finalized: 4,
          Released: 5,
        } as const;

        const aRank = order[a.stateLabel as keyof typeof order] ?? 99;
        const bRank = order[b.stateLabel as keyof typeof order] ?? 99;

        if (aRank !== bRank) return aRank - bRank;
        return a.employee.fullName.localeCompare(b.employee.fullName);
      });
  }, [rows, search, filter]);

  const selectedRows = filteredRows.filter((row) =>
    selectedIds.includes(row.employee.id)
  );

  const allSelectedOnPage =
    filteredRows.length > 0 &&
    filteredRows.every((row) => selectedIds.includes(row.employee.id));

  const processableSelectedIds = selectedRows
    .filter((row) => !row.finalized && !row.released)
    .map((row) => row.employee.id);

  const releasableSelectedIds = selectedRows
    .filter((row) => row.finalized && !row.released)
    .map((row) => row.employee.id);

  const canProcessSelected =
    selectedRows.length > 0 &&
    processableSelectedIds.length === selectedRows.length;

  const allSelectedFinalizedOnly =
    selectedRows.length > 0 &&
    releasableSelectedIds.length === selectedRows.length;

  function clearSelection() {
    setSelectedIds([]);
    setBulkError(null);
  }

  function handleProcessSelected() {
    if (!canProcessSelected) return;

    setBulkError(null);

    const params = new URLSearchParams();
    params.set("employeeIds", processableSelectedIds.join(","));
    params.set("index", "0");
    params.set("cycleId", cycleId);

    router.push(`/admin/review-queue?${params.toString()}`);
  }

  function handleReleaseFinalized() {
    if (!allSelectedFinalizedOnly || releasableSelectedIds.length === 0) return;

    setBulkError(null);

    startTransition(async () => {
      try {
        for (const employeeId of releasableSelectedIds) {
          const response = await fetch("/api/admin/release-employee-cycle", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              cycleId,
              employeeId,
            }),
          });

          if (!response.ok) {
            const text = await response.text();
            throw new Error(text || "Failed to release employee.");
          }
        }

        clearSelection();
        router.refresh();
      } catch (error) {
        setBulkError(
          error instanceof Error ? error.message : "Bulk release failed."
        );
      }
    });
  }

  function toggleOne(employeeId: string) {
    setSelectedIds((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    );
  }

  function toggleAllOnPage() {
    if (allSelectedOnPage) {
      setSelectedIds((prev) =>
        prev.filter((id) => !filteredRows.some((row) => row.employee.id === id))
      );
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const row of filteredRows) next.add(row.employee.id);
      return Array.from(next);
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-orange-100/70 bg-[#fff7f0]/70 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-base font-semibold text-slate-900">Current cycle</div>
            <div className="mt-1 text-sm text-slate-600">
              {cycleName} · <span className="font-medium text-slate-900">{cycleStatus}</span>
            </div>
          </div>

          <div className="rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
            {filteredRows.length} employees
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employees, role, or code"
            className="h-10 rounded-xl border border-orange-100 bg-white px-3 text-sm text-slate-900 outline-none"
          />

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterValue)}
            className="h-10 rounded-xl border border-orange-100 bg-white px-3 text-sm text-slate-900 outline-none"
          >
            <option value="all">Status: All</option>
            <option value="needs_review">Needs review</option>
            <option value="ready_to_finalize">Ready to finalize</option>
            <option value="finalized">Finalized</option>
            <option value="released">Released</option>
          </select>
        </div>
      </section>

      {selectedIds.length > 0 ? (
        <section className="rounded-2xl border border-orange-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full border border-orange-200 bg-[#fff7f0] px-3 py-1 text-xs font-semibold text-slate-700">
              {selectedIds.length} selected
            </div>

            <button
              type="button"
              onClick={handleProcessSelected}
              disabled={!canProcessSelected || isPending}
              title={
                canProcessSelected
                  ? "Open selected employees in bulk processing."
                  : "Only not-finalized, unreleased employees can be processed in bulk."
              }
              className={
                canProcessSelected && !isPending
                  ? "inline-flex h-10 items-center justify-center rounded-xl border border-orange-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm hover:bg-orange-50"
                  : "inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-400 shadow-sm"
              }
            >
              Process Selected
            </button>

            <button
              type="button"
              onClick={handleReleaseFinalized}
              disabled={!allSelectedFinalizedOnly || isPending}
              title={
                allSelectedFinalizedOnly
                  ? "Release all selected finalized employees."
                  : "Only finalized, unreleased employees can be bulk released."
              }
              className={
                allSelectedFinalizedOnly && !isPending
                  ? "inline-flex h-10 items-center justify-center rounded-xl border border-orange-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm hover:bg-orange-50"
                  : "inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-400 shadow-sm"
              }
            >
              {isPending ? "Working..." : "Release Finalized"}
            </button>

            <button
              type="button"
              onClick={clearSelection}
              disabled={isPending}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-orange-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm hover:bg-orange-50 disabled:opacity-50"
            >
              Clear
            </button>
          </div>

          {bulkError ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {bulkError}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-orange-100/70 bg-white shadow-sm">
        <div className="hidden grid-cols-[44px_minmax(220px,1.3fr)_minmax(140px,0.9fr)_minmax(220px,1.1fr)_minmax(150px,0.8fr)_minmax(140px,0.7fr)_160px] gap-3 border-b border-orange-100 bg-[#fff7f0]/70 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 lg:grid">
          <div>
            <input
              type="checkbox"
              checked={allSelectedOnPage}
              onChange={toggleAllOnPage}
              className="h-4 w-4"
              aria-label="Select all"
            />
          </div>
          <div>Employee</div>
          <div>Role</div>
          <div>Reviews status</div>
          <div>Finalization</div>
          <div>Release</div>
          <div>Action</div>
        </div>

        <div className="divide-y divide-orange-100">
          {filteredRows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-slate-600">
              No employees match this cycle view.
            </div>
          ) : null}

          {filteredRows.map((row) => (
            <div
              key={row.employee.id}
              className={`px-4 py-4 transition-colors ${rowTint(row)}`}
            >
              <div className="grid gap-4 lg:grid-cols-[44px_minmax(220px,1.3fr)_minmax(140px,0.9fr)_minmax(220px,1.1fr)_minmax(150px,0.8fr)_minmax(140px,0.7fr)_160px] lg:items-center">
                <div className="pt-1">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(row.employee.id)}
                    onChange={() => toggleOne(row.employee.id)}
                    className="h-4 w-4"
                    aria-label={`Select ${row.employee.fullName}`}
                  />
                </div>

                <div className="min-w-0">
                  <Link
                    href={`/admin/employees/${row.employee.id}`}
                    className="text-sm font-semibold text-slate-900 hover:underline"
                  >
                    {row.employee.fullName}
                  </Link>

                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    {row.employee.email ? <span>{row.employee.email}</span> : null}
                    {row.employee.employeeCode ? (
                      <>
                        {row.employee.email ? <span>•</span> : null}
                        <span>{row.employee.employeeCode}</span>
                      </>
                    ) : null}
                    {row.primaryReviewerName ? (
                      <>
                        <span>•</span>
                        <span>Primary reviewer: {row.primaryReviewerName}</span>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="text-sm text-slate-700">
                  {row.employee.jobRoleName ?? "No role"}
                </div>

                <div className="space-y-1 text-sm text-slate-700">
                  <div>Self {row.selfSubmitted ? "✔" : "—"}</div>
                  <div>Primary {row.primarySubmitted ? "✔" : "—"}</div>
                  <div>
                    Peer ({row.peerCompleted}/{row.peerTotal})
                  </div>
                </div>

                <div>
                  <span className={badgeClass(row.finalized ? "neutral" : row.stateTone)}>
                    {row.finalized ? "Finalized" : row.stateLabel}
                  </span>
                </div>

                <div>
                  <span className={badgeClass(row.released ? "success" : "neutral")}>
                    {row.released ? "Released" : "Not released"}
                  </span>
                </div>

                <div>
                  <Link
                    href={`/admin/employees/${row.employee.id}`}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90"
                  >
                    Process Review
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}