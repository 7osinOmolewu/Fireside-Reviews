"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyRole } from "@/lib/me";
import { getActiveCycleIdClient } from "@/lib/activeCycleClient";

type PublicSummary = {
  id: string;
  cycle_id: string;
  employee_id: string;
  performance_rating: string | null;
  final_narrative_employee_visible: string | null;
  finalized_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  review_cycles?: { id: string; name: string } | null;
};

type CurrentCycleSummary = {
  id: string;
  cycle_id: string;
  employee_id: string;
  performance_rating: string | null;
  final_narrative_employee_visible: string | null;
  finalized_at: string | null;
  released_at: string | null;
  created_at: string | null;
  review_cycles?: { id: string; name: string } | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning";
}) {
  const toneClasses: Record<string, string> = {
    neutral: "bg-slate-50 text-slate-700 ring-slate-200",
    success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    warning: "bg-amber-50 text-amber-800 ring-amber-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
        toneClasses[tone] ?? toneClasses.neutral
      )}
    >
      {label}
    </span>
  );
}

export default function EmployeePage() {
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<PublicSummary[]>([]);
  const [currentCycleSummaries, setCurrentCycleSummaries] = useState<CurrentCycleSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [userName, setUserName] = useState<string>("Employee");
  const [inboxCount, setInboxCount] = useState<number>(0);

  const [cycleLabel, setCycleLabel] = useState<string>("");

  const latestReleased = useMemo(() => summaries?.[0] ?? null, [summaries]);

  useEffect(() => {
    (async () => {
      try {
        const me = await getMyRole();
        if (!me) {
          window.location.href = "/login";
          return;
        }
        setUserName(me.fullName ?? "Employee");

        const { data: authRes, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const user = authRes?.user;
        if (!user) {
          window.location.href = "/login";
          return;
        }

        // Open cycles for employee "current cycle" context
        const { data: openCycles, error: openCyclesErr } = await supabase
          .from("review_cycles")
          .select("id, name, status")
          .in("status", ["calibrating"]);

        if (openCyclesErr) throw openCyclesErr;

        const globalActiveCycleId = await getActiveCycleIdClient();
        const openCycleIds = (openCycles ?? []).map((c) => c.id);
        const cycleById = new Map<string, string>((openCycles ?? []).map((c) => [c.id, c.name]));

        const selectedCycleId =
          globalActiveCycleId && openCycleIds.includes(globalActiveCycleId)
            ? globalActiveCycleId
            : openCycleIds[0] ?? null;

        const label =
          selectedCycleId
            ? cycleById.get(selectedCycleId) ?? "Selected cycle"
            : openCycleIds.length > 1
            ? "All open cycles"
            : openCycleIds.length === 1
            ? cycleById.get(openCycleIds[0]) ?? "Open cycle"
            : "No open cycles";

        setCycleLabel(label);

        // 1) current cycle summary rows (released or not)
        const { data: curData, error: curErr } = openCycleIds.length
          ? await supabase
              .from("cycle_employee_summary_public")
              .select(
                `
                id,
                cycle_id,
                employee_id,
                performance_rating,
                final_narrative_employee_visible,
                finalized_at,
                released_at,
                created_at,
                review_cycles ( id, name )
              `
              )
              .eq("employee_id", user.id)
              .in("cycle_id", openCycleIds)
              .order("created_at", { ascending: false })
          : { data: [], error: null };

        if (curErr) throw curErr;
        setCurrentCycleSummaries((curData ?? []) as CurrentCycleSummary[]);

        // 2) released summaries (history)
        const { data: releasedData, error: releasedErr } = await supabase
          .from("cycle_employee_summary_public")
          .select(
            `
            id,
            cycle_id,
            employee_id,
            performance_rating,
            final_narrative_employee_visible,
            finalized_at,
            created_at,
            updated_at,
            review_cycles ( id, name )
          `
          )
          .eq("employee_id", user.id)
          .not("released_at", "is", null)
          .order("released_at", { ascending: false });

        if (releasedErr) throw releasedErr;
        setSummaries((releasedData ?? []) as PublicSummary[]);

        // 3) inbox count for open cycles only
        if (openCycleIds.length === 0) {
          setInboxCount(0);
        } else {
          const { count, error: countErr } = await supabase
            .from("review_assignments")
            .select("id", { count: "exact", head: true })
            .eq("reviewer_id", user.id)
            .eq("is_active", true)
            .in("cycle_id", openCycleIds);

          if (!countErr) setInboxCount(count ?? 0);
        }
      } catch (e: any) {
        setError(e?.message ?? "Failed to load employee view.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const currentStatus = useMemo(() => {
    // prioritize any current cycle row
    const cur = currentCycleSummaries?.[0];
    if (!cur) {
      return {
        tone: "neutral" as const,
        label: "No active cycle",
        message: "There is no active review cycle right now.",
        showResults: false,
      };
    }

    const isReleased = Boolean(cur.released_at);
    const isFinalized = Boolean(cur.finalized_at);

    if (isReleased) {
      return {
        tone: "success" as const,
        label: "Released Reviews",
        message: "Your results are available below.",
        showResults: true,
      };
    }

    if (isFinalized) {
      return {
        tone: "warning" as const,
        label: "Finalized, not released",
        message: "Your review has been finalized. Results will appear here after Admin releases the cycle.",
        showResults: false,
      };
    }

    return {
      tone: "neutral" as const,
      label: "In progress",
      message: "Your review is in progress. Results will appear here after finalization and release.",
      showResults: false,
    };
  }, [currentCycleSummaries]);

  return (
    <>
      {/* PageHeader to match the rest of the app */}
      <div className="mb-4">
        <div className="text-2xl font-extrabold tracking-tight text-slate-900">
          {userName}'s Performance Reviews
          {cycleLabel ? (
            <span className="ml-2 text-lg font-extrabold text-slate-500">({cycleLabel})</span>
          ) : null}
        </div>
      </div>

      {/* Error */}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <div className="font-semibold">Error</div>
          <div className="mt-1">{error}</div>
        </div>
      ) : null}

      {!error && loading ? (
        <div className="rounded-2xl border border-orange-100/70 bg-[#fff7f0]/60 p-4 text-sm text-slate-700">
          Loading your employee view…
        </div>
      ) : null}

      {!error && !loading ? (
        <div className="space-y-4">
          {/* Primary employee status card */}
          <div className="rounded-2xl border border-orange-100/70 bg-[#fff7f0]/60 p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-base font-semibold text-slate-900">
                    Your review status
                  </div>
                  <Badge label={currentStatus.label} tone={currentStatus.tone} />
                </div>
                <div className="mt-1 text-sm text-slate-700">{currentStatus.message}</div>
              </div>

              <Link
                href="/reviews"
                className="inline-flex items-center justify-center rounded-xl border border-orange-200 bg-[#fff7f0] px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-orange-50"
              >
                My Review Inbox
                <span className="ml-2 inline-flex items-center rounded-full border border-orange-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-900">
                  {inboxCount}
                </span>
              </Link>
            </div>

            {/* Results block (only if released) */}
            {currentStatus.showResults ? (
              <div className="mt-4 rounded-2xl border border-orange-100/70 bg-white p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm font-semibold text-slate-900">
                    Latest released summary
                  </div>
                  <div className="text-sm text-slate-600">
                    Rating:{" "}
                    <span className="font-semibold text-slate-900">
                      {currentCycleSummaries?.[0]?.performance_rating ?? "—"}
                    </span>
                  </div>
                </div>

                <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                  {currentCycleSummaries?.[0]?.final_narrative_employee_visible ?? "—"}
                </div>
              </div>
            ) : null}
          </div>

          {/* History */}
          <div className="rounded-2xl border border-orange-100/70 bg-[#fffdfb]/60 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Released history</div>
              <div className="text-xs text-slate-500">
                {summaries.length > 0 ? `${summaries.length} cycle(s)` : ""}
              </div>
            </div>

            {summaries.length === 0 ? (
              <div className="mt-3 text-sm text-slate-600">
                No released summaries yet.
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {summaries.map((s) => {
                  const cycleName = s.review_cycles?.name ?? s.cycle_id;
                  const narrative = s.final_narrative_employee_visible ?? "";

                  return (
                    <div
                      key={s.id}
                      className="rounded-2xl border border-orange-100/70 bg-white p-4"
                    >
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm font-semibold text-slate-900">{cycleName}</div>
                        <div className="text-sm text-slate-600">
                          Rating:{" "}
                          <span className="font-semibold text-slate-900">
                            {s.performance_rating ?? "—"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                        {narrative ? narrative : <span className="text-slate-500">No employee-visible narrative was published.</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
