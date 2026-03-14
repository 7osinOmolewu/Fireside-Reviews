"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/app/_components/page-header";
import { supabase } from "@/lib/supabaseClient";
import { getMyRole } from "@/lib/me";

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

type ArchiveRow = {
  id: string;
  employee_id: string;
  employee_email: string | null;
  employee_name: string | null;
  cycle_id: string;
  cycle_name: string | null;
  performance_rating: string | null;
  performance_rating_value: number | null;
  final_narrative_employee_visible: string | null;
  finalized_at: string | null;
  released_at: string | null;
  archived_at: string;
  archived_by: string | null;
  source: string;
};

type ArchiveGroup = {
  employee_id: string;
  employee_name: string | null;
  employee_email: string | null;
  last_archived_at: string;
  archived_by: string | null;
  cycles: ArchiveRow[];
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function AdminArchivesPage() {
  const [rows, setRows] = useState<ArchiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [deletedByNameById, setDeletedByNameById] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      try {
        const me = await getMyRole();
        if (!me) {
          window.location.href = "/login";
          return;
        }
        if (me.role !== "admin") {
          window.location.href = "/";
          return;
        }

        const { data, error } = await (supabase as any)
          .from("employee_cycle_history_archive")
          .select("*")
          .order("archived_at", { ascending: false });

        if (error) throw error;

        const archiveRows = (data ?? []) as ArchiveRow[];
        setRows(archiveRows);

        const archivedByIds = Array.from(
          new Set(
            archiveRows
              .map((r) => r.archived_by)
              .filter((v): v is string => Boolean(v))
          )
        );

        if (archivedByIds.length > 0) {
          const { data: profiles, error: profilesErr } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", archivedByIds);

          if (!profilesErr) {
            const map: Record<string, string> = {};
            for (const p of profiles ?? []) {
              map[p.id] = p.full_name ?? p.email ?? p.id;
            }
            setDeletedByNameById(map);
          }
        }
      } catch (e: any) {
        setError(e?.message ?? "Failed to load archives.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const archiveGroups = useMemo(() => {
    const grouped = new Map<string, ArchiveGroup>();

    for (const row of rows) {
      const existing = grouped.get(row.employee_id);

      if (!existing) {
        grouped.set(row.employee_id, {
          employee_id: row.employee_id,
          employee_name: row.employee_name,
          employee_email: row.employee_email,
          last_archived_at: row.archived_at,
          archived_by: row.archived_by,
          cycles: [row],
        });
      } else {
        if (row.archived_at > existing.last_archived_at) {
          existing.last_archived_at = row.archived_at;
        }
        existing.cycles.push(row);
      }
    }

    return Array.from(grouped.values()).sort((a, b) =>
      b.last_archived_at.localeCompare(a.last_archived_at)
    );
  }, [rows]);

  function toggleOpen(employeeId: string) {
    setOpenIds((prev) => ({
      ...prev,
      [employeeId]: !prev[employeeId],
    }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Archives"
        description="Read-only archive of preserved cycle performance history for deleted employees."
      />

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-orange-100/70 bg-[#fff7f0]/60 p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold text-slate-900">Archive snapshot</div>
          <Badge
            label={`${archiveGroups.length} archived employee${archiveGroups.length === 1 ? "" : "s"}`}
          />
          <Badge
            label={`${rows.length} archived cycle record${rows.length === 1 ? "" : "s"}`}
            tone="warning"
          />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          This view preserves only the per-cycle rating and final employee-visible narrative captured before a hard delete.
        </p>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-orange-100/70 bg-[#fffdfb]/70 p-6 text-sm text-slate-600">
          Loading archives...
        </div>
      ) : archiveGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-orange-200 bg-[#fffdfb]/70 p-6 text-sm text-slate-600">
          No archived employee history yet.
        </div>
      ) : (
        <section className="rounded-2xl border border-orange-100/70 bg-[#fffdfb]/70 p-4 shadow-sm">
          <div className="space-y-3">
            {archiveGroups.map((group) => {
              const isOpen = Boolean(openIds[group.employee_id]);
              const deletedBy =
                (group.archived_by && deletedByNameById[group.archived_by]) ||
                group.archived_by ||
                "—";

              return (
                <div
                  key={group.employee_id}
                  className="rounded-2xl border border-orange-100/70 bg-[#fff7f0]/40 shadow-sm"
                >
                  <div className="grid gap-3 px-4 py-4 lg:grid-cols-[1.2fr_1.2fr_0.7fr_1fr_1fr_auto] lg:items-center">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Employee
                      </div>
                      <div className="mt-1 text-base font-semibold text-slate-900">
                        {group.employee_name ?? "Unknown employee"}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Email
                      </div>
                      <div className="mt-1 text-sm text-slate-900">
                        {group.employee_email ?? "—"}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Cycles
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {group.cycles.length}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Archived
                      </div>
                      <div className="mt-1 text-sm text-slate-900">
                        {formatDateTime(group.last_archived_at)}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Deleted By
                      </div>
                      <div className="mt-1 text-sm text-slate-900">
                        {deletedBy}
                      </div>
                    </div>

                    <div className="flex justify-start lg:justify-end">
                      <button
                        type="button"
                        onClick={() => toggleOpen(group.employee_id)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-orange-200 bg-[#fff7f0] text-lg font-semibold text-slate-900 shadow-sm hover:bg-orange-50"
                        aria-label={isOpen ? "Collapse archive details" : "Expand archive details"}
                        title={isOpen ? "Collapse" : "Expand"}
                      >
                       {isOpen ? (
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                            <path
                            d="M5 12l5-5 5 5"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            />
                        </svg>
                        ) : (
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                            <path
                            d="M5 8l5 5 5-5"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            />
                        </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {isOpen ? (
                    <div className="border-t border-orange-100/70 px-4 py-4">
                      <div className="space-y-3">
                        {group.cycles
                          .sort((a, b) => b.archived_at.localeCompare(a.archived_at))
                          .map((row) => (
                            <div
                              key={row.id}
                              className="rounded-xl border border-orange-100/70 bg-white/80 p-3"
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <div className="text-base font-semibold text-slate-900 ml-1 mb-2">
                                    {row.cycle_name ?? row.cycle_id}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-1 rounded-xl border border-orange-100/70 bg-[#fff7f0]/35 p-2">
                                <div className="text-sm font-bold text-slate-900">
                                    FINAL:
                                    <span
                                        className={cn(
                                        "ml-2 rounded-full px-2 py-0.5 text-xs font-semibold",
                                        row.performance_rating === "EXCEEDS_EXPECTATIONS" && "bg-emerald-100 text-emerald-800",
                                        row.performance_rating === "MEETS_EXPECTATIONS" && "bg-green-100 text-green-800",
                                        row.performance_rating === "NEEDS_DEVELOPMENT" && "bg-amber-100 text-amber-800",
                                        row.performance_rating === "UNSATISFACTORY" && "bg-red-100 text-red-800"
                                        )}
                                    >
                                        {row.performance_rating ?? "—"}
                                    </span>
                                </div>
                                <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                                  {row.final_narrative_employee_visible ?? "No final narrative preserved."}
                                </div>
                                  <div className="mt-2 text-xs text-slate-500">
                                    Finalized {formatDateTime(row.finalized_at)} ·
                                    Released {formatDateTime(row.released_at)} ·
                                    Archived {formatDateTime(row.archived_at)}
                                </div> 
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}