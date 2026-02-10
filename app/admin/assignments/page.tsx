"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyRole } from "@/lib/me";
import { AdminReopenReviewButton } from "@/app/_components/AdminReopenReviewButton";
import { useCycleSelection } from "@/app/_components/useCycleSelection";

import Link from "next/link";

export function BackToAdmin() {
  return (
    <Link href="/admin" style={{ textDecoration: "underline" }}>
      Admin
    </Link>
  );
}

type Cycle = { id: string; name: string; start_date: string; end_date: string; status: string };
type ReviewMeta = {
  review_id: string;
  assignment_id: string;
  status: string;
  submitted_at: string | null;
  updated_at: string | null;
};

type ProfileLite = {
  id: string;
  full_name: string | null;
  can_review: boolean | null;
};

type EmployeeRow = {
  id: string; // user id
  job_role_id: string | null;
  employee_code: string | null;
  job_roles: { id: string; code: string; name: string } | null;
  profiles: { full_name: string | null } | null;
};

type ReviewerType = "primary" | "self" | "secondary" | "peer";

type AssignmentRow = {
  employee_id: string;
  reviewer_id: string;
  reviewer_type: ReviewerType;
  is_active: boolean;
};

export default function AssignmentsAdminPage() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [reviewers, setReviewers] = useState<ProfileLite[]>([]);


  const [defaultCycleId, setDefaultCycleId] = useState<string>("");
  const { cycleId: selectedCycleId, setCycleId: setSelectedCycleId } = useCycleSelection(defaultCycleId);

  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Loading...");

  // per-employee selection state
  const [primaryByEmployee, setPrimaryByEmployee] = useState<Record<string, string>>({});
  const [secondaryByEmployee, setSecondaryByEmployee] = useState<Record<string, string>>({});
  const [peersByEmployee, setPeersByEmployee] = useState<Record<string, string[]>>({});
  const [releaseByEmployee, setReleaseByEmployee] = useState<Record<string, { released_at: string | null }>>({});

  const [reviewMetaByEmployee, setReviewMetaByEmployee] = useState<Record<string, ReviewMeta>>({});

  async function loadPrimaryReviewMeta(cycleId: string) {
    // Pull reviews for PRIMARY assignments in this cycle (active only)
    const { data, error } = await supabase
      .from("reviews")
      .select(
        `
        id,
        assignment_id,
        status,
        submitted_at,
        updated_at,
        review_assignments!inner (
          employee_id,
          reviewer_type,
          is_active
        )
      `
      )
      .eq("cycle_id", cycleId)
      .eq("review_assignments.reviewer_type", "primary")
      .eq("review_assignments.is_active", true)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const map: Record<string, ReviewMeta> = {};
    for (const r of (data ?? []) as any[]) {
      const employeeId = r.review_assignments?.employee_id;
      if (!employeeId) continue;

      map[employeeId] = {
        review_id: r.id,
        assignment_id: r.assignment_id,
        status: r.status,
        submitted_at: r.submitted_at ?? null,
        updated_at: r.updated_at ?? null,
      };
    }
    setReviewMetaByEmployee(map);
  }

  async function loadCycles() {
    const { data, error } = await supabase
      .from("review_cycles")
      .select("id,name,start_date,end_date,status")
      .order("start_date", { ascending: false });

    if (error) throw error;

    const list = (data ?? []) as Cycle[];
    setCycles(list);

    // If you’re using the global URL/localStorage hook with fallback:
    if (list.length > 0) setDefaultCycleId(list[0].id);
  }

  async function loadEmployees() {
    const { data, error } = await supabase
      .from("employees")
      .select(
        `
        id,
        job_role_id,
        employee_code,
        job_roles:job_role_id ( id, code, name ),
        profiles ( full_name )
      `
      )
      .order("employee_code", { ascending: true });

    if (error) throw error;
    setEmployees((data ?? []) as any);
  }

  async function loadReviewers() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, can_review")
      .eq("can_review", true)
      .order("full_name", { ascending: true });

    if (error) throw error;
    setReviewers((data ?? []) as any);
  }

  async function loadExistingAssignments(cycleId: string) {
    const { data, error } = await supabase
      .from("review_assignments")
      .select("employee_id, reviewer_id, reviewer_type, is_active")
      .eq("cycle_id", cycleId)
      .eq("is_active", true);

    if (error) throw error;

    const primary: Record<string, string> = {};
    const secondary: Record<string, string> = {};
    const peers: Record<string, string[]> = {};

    for (const row of (data ?? []) as AssignmentRow[]) {
      const empId = row.employee_id;
      const revId = row.reviewer_id;
      const t = row.reviewer_type;

      if (t === "primary") primary[empId] = revId;
      if (t === "secondary") secondary[empId] = revId;
      if (t === "peer") peers[empId] = [...(peers[empId] ?? []), revId];
      // ignore "self"
    }

    setPrimaryByEmployee(primary);
    setSecondaryByEmployee(secondary);
    setPeersByEmployee(peers);
  }

  async function loadReleaseState(cycleId: string) {
    const { data, error } = await supabase
      .from("cycle_employee_summary_public")
      .select("employee_id, released_at")
      .eq("cycle_id", cycleId);

    if (error) throw error;

    const map: Record<string, { released_at: string | null }> = {};
    for (const row of (data ?? []) as any[]) {
      map[row.employee_id] = { released_at: row.released_at ?? null };
    }
    setReleaseByEmployee(map);
  }

  useEffect(() => {
    (async () => {
      setError(null);
      const me = await getMyRole();
      if (!me) return (window.location.href = "/login");
      if (me.role !== "admin") return (window.location.href = "/");

      await Promise.all([loadCycles(), loadEmployees(), loadReviewers()]);
      setStatus("Ready");
    })().catch((e: any) => {
      setError(e.message ?? "Unknown error");
      setStatus("Error");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedCycleId) return;
    (async () => {
      setError(null);
      setStatus("Loading assignments...");
      await loadExistingAssignments(selectedCycleId);
      await loadReleaseState(selectedCycleId);
      await loadPrimaryReviewMeta(selectedCycleId);

      setStatus("Ready");
    })().catch((e: any) => {
      setError(e.message ?? "Failed to load assignments");
      setStatus("Error");
    });
  }, [selectedCycleId]);

  const cycleOptions = useMemo(() => cycles.map((c) => ({ value: c.id, label: c.name })), [cycles]);

  function setPrimary(employeeId: string, reviewerId: string) {
    setPrimaryByEmployee((prev) => ({ ...prev, [employeeId]: reviewerId }));
  }

  function setSecondary(employeeId: string, reviewerId: string) {
    setSecondaryByEmployee((prev) => ({ ...prev, [employeeId]: reviewerId }));
  }

  function togglePeer(employeeId: string, reviewerId: string) {
    const cur = peersByEmployee[employeeId] ?? [];
    const next = cur.includes(reviewerId) ? cur.filter((x) => x !== reviewerId) : [...cur, reviewerId];
    setPeersByEmployee((prev) => ({ ...prev, [employeeId]: next }));
  }

  async function upsertReviewAssignment(params: {
    cycleId: string;
    employeeId: string;
    reviewerId: string;
    reviewerType: ReviewerType;
    isRequired: boolean;
    isActive: boolean;
    createdBy: string;
  }) {
    const { data, error } = await supabase
      .from("review_assignments")
      .upsert(
        {
          cycle_id: params.cycleId,
          employee_id: params.employeeId,
          reviewer_id: params.reviewerId,
          reviewer_type: params.reviewerType,
          is_required: params.isRequired,
          is_active: params.isActive,
          created_by: params.createdBy,
        },
        { onConflict: "cycle_id,employee_id,reviewer_id,reviewer_type" }
      )
      .select("id")
      .single();

    if (error) throw error;
    return data.id as string;
  }

  async function upsertReviewRow(params: {
    assignmentId: string;
    cycleId: string;
    employeeId: string;
    reviewerId: string;
    reviewerType: ReviewerType;
  }) {
    const { error } = await supabase.from("reviews").upsert(
      {
        assignment_id: params.assignmentId,
        cycle_id: params.cycleId,
        employee_id: params.employeeId,
        reviewer_id: params.reviewerId,
        reviewer_type: params.reviewerType,
        status: "draft",
      },
      { onConflict: "assignment_id" }
    );

    if (error) throw error;
  }

  async function deactivateAssignmentsNotInSet(params: {
    cycleId: string;
    employeeId: string;
    keep: Array<{ reviewerId: string; reviewerType: ReviewerType }>;
  }) {
    const keepSet = new Set(params.keep.map((k) => `${k.reviewerType}:${k.reviewerId}`));

    const { data, error } = await supabase
      .from("review_assignments")
      .select("id, reviewer_id, reviewer_type")
      .eq("cycle_id", params.cycleId)
      .eq("employee_id", params.employeeId)
      .eq("is_active", true)
      .neq("reviewer_type", "self");

    if (error) throw error;

    const toDeactivate = (data ?? []).filter((r: any) => !keepSet.has(`${r.reviewer_type}:${r.reviewer_id}`));
    if (toDeactivate.length === 0) return;

    const ids = toDeactivate.map((r: any) => r.id);
    const { error: updErr } = await supabase.from("review_assignments").update({ is_active: false }).in("id", ids);
    if (updErr) throw updErr;
  }

  async function assignForEmployee(employeeId: string) {
    if (!selectedCycleId) {
      setError("Select a cycle first.");
      return;
    }

    const primaryReviewerId = primaryByEmployee[employeeId];
    if (!primaryReviewerId) {
      setError("Primary reviewer is required for each employee you assign.");
      return;
    }

    const secondaryReviewerId = secondaryByEmployee[employeeId] || "";
    const peerReviewerIds = peersByEmployee[employeeId] ?? [];

    setError(null);
    setStatus("Assigning...");

    try {
      const me = await getMyRole();
      if (!me) return (window.location.href = "/login");

      // 0) Deactivate things that are no longer selected (primary/secondary/peer)
      const keep: Array<{ reviewerId: string; reviewerType: ReviewerType }> = [
        { reviewerId: primaryReviewerId, reviewerType: "primary" },
        ...peerReviewerIds.map((id) => ({ reviewerId: id, reviewerType: "peer" as const })),
      ];
      if (secondaryReviewerId) keep.push({ reviewerId: secondaryReviewerId, reviewerType: "secondary" });

      await deactivateAssignmentsNotInSet({ cycleId: selectedCycleId, employeeId, keep });

      // 1) Self (always)
      const selfAssignmentId = await upsertReviewAssignment({
        cycleId: selectedCycleId,
        employeeId,
        reviewerId: employeeId,
        reviewerType: "self",
        isRequired: true,
        isActive: true,
        createdBy: me.userId,
      });
      await upsertReviewRow({
        assignmentId: selfAssignmentId,
        cycleId: selectedCycleId,
        employeeId,
        reviewerId: employeeId,
        reviewerType: "self",
      });

      // 2) Primary (single)
      const primaryAssignmentId = await upsertReviewAssignment({
        cycleId: selectedCycleId,
        employeeId,
        reviewerId: primaryReviewerId,
        reviewerType: "primary",
        isRequired: true,
        isActive: true,
        createdBy: me.userId,
      });
      await upsertReviewRow({
        assignmentId: primaryAssignmentId,
        cycleId: selectedCycleId,
        employeeId,
        reviewerId: primaryReviewerId,
        reviewerType: "primary",
      });

      // 3) Secondary (single, optional)
      if (secondaryReviewerId) {
        const secAssignmentId = await upsertReviewAssignment({
          cycleId: selectedCycleId,
          employeeId,
          reviewerId: secondaryReviewerId,
          reviewerType: "secondary",
          isRequired: false,
          isActive: true,
          createdBy: me.userId,
        });
        await upsertReviewRow({
          assignmentId: secAssignmentId,
          cycleId: selectedCycleId,
          employeeId,
          reviewerId: secondaryReviewerId,
          reviewerType: "secondary",
        });
      }

      // 4) Peers (multi, optional)
      for (const peerId of peerReviewerIds) {
        const assignmentId = await upsertReviewAssignment({
          cycleId: selectedCycleId,
          employeeId,
          reviewerId: peerId,
          reviewerType: "peer",
          isRequired: false,
          isActive: true,
          createdBy: me.userId,
        });
        await upsertReviewRow({
          assignmentId,
          cycleId: selectedCycleId,
          employeeId,
          reviewerId: peerId,
          reviewerType: "peer",
        });
      }

      setStatus("Assigned ✓");
      await loadExistingAssignments(selectedCycleId);
    } catch (e: any) {
      setError(e.message ?? "Assignment failed");
      setStatus("Ready");
    }
  }

  async function releaseForEmployee(employeeId: string) {
    if (!selectedCycleId) {
      setError("Select a cycle first.");
      return;
    }

    const alreadyReleasedAt = releaseByEmployee[employeeId]?.released_at ?? null;
    if (alreadyReleasedAt) return;

    setError(null);
    setStatus("Releasing...");

    try {
      const res = await fetch("/api/admin/release-employee-cycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId: selectedCycleId, employeeId }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Release failed");

      const releasedAt = (json?.summary?.released_at as string | undefined) ?? null;

      setReleaseByEmployee((prev) => ({
        ...prev,
        [employeeId]: { released_at: releasedAt },
      }));

      setStatus("Released ✓");
    } catch (e: any) {
      setError(e.message ?? "Release failed");
      setStatus("Ready");
    }
  }

return (
  <main
    style={{
      minHeight: "100vh",
      background: "#f8fafc",
      padding: 24,
      fontFamily: "system-ui",
    }}
  >
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            <BackToAdmin /> <span style={{ margin: "0 6px" }}>·</span> Assignments
          </div>
          <h1 style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
            Review Assignments
          </h1>
        </div>

        <Link
          href="/reviews"
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            background: "white",
            textDecoration: "none",
            fontWeight: 700,
            color: "#0f172a",
            whiteSpace: "nowrap",
          }}
        >
          Go to Reviews →
        </Link>
      </div>

      {/* Controls */}
      <div
        style={{
          marginTop: 14,
          padding: 14,
          borderRadius: 16,
          border: "1px solid #e2e8f0",
          background: "white",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>Cycle</div>
          <select
            value={selectedCycleId}
            onChange={(e) => setSelectedCycleId(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              background: "white",
              minWidth: 260,
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            {cycleOptions.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <span style={{ fontSize: 12, color: "#64748b" }}>{status}</span>
        </div>

        {error ? (
          <div style={{ color: "#b91c1c", fontSize: 12, fontWeight: 700 }}>{error}</div>
        ) : (
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Employees: <span style={{ fontWeight: 800, color: "#0f172a" }}>{employees.length}</span>
          </div>
        )}
      </div>

      {/* Table */}
      <div
        style={{
          marginTop: 14,
          borderRadius: 16,
          border: "1px solid #e2e8f0",
          background: "white",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Employee</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Employee Code</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Role</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Primary (required)</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Secondary (optional)</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Peers (optional)</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Status</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {employees.map((emp) => {
              const empName = emp.profiles?.full_name ?? "(no name)";
              const primary = primaryByEmployee[emp.id] ?? "";
              const secondary = secondaryByEmployee[emp.id] ?? "";
              const peers = peersByEmployee[emp.id] ?? [];

              const meta = reviewMetaByEmployee[emp.id] ?? null;
              const reviewStatus = meta?.status ?? "none";
              const isCommitted = reviewStatus === "submitted" || reviewStatus === "finalized";

              const releasedAt = releaseByEmployee[emp.id]?.released_at ?? null;
              const isReleased = Boolean(releasedAt);

              const reviewersForThisEmployee = reviewers.filter((r) => r.id !== emp.id);

              const primaryReadyToRelease = Boolean(meta && isCommitted);
              const canRelease = !isReleased && primaryReadyToRelease;
              const canReopen = Boolean(meta && isCommitted && !releasedAt);
              const reopenTooltip =
                !meta
                  ? "No primary review exists yet"
                  : !isCommitted
                  ? "Only committed (submitted/finalized) reviews can be reopened"
                  : releasedAt
                  ? "Locked after release"
                  : undefined;
              const releaseTooltip =
                isReleased
                  ? "Already released"
                  : !meta
                  ? "Primary review has not been started"
                  : !isCommitted
                  ? "Waiting on primary review commit"
                  : undefined;

              return (
                <tr key={emp.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                  <td style={tdStrong}>{empName}</td>
                  <td style={tdMono}>{emp.employee_code ?? "-"}</td>
                  <td style={td}>{emp.job_roles?.name ?? "(none)"}</td>

                  <td style={td}>
                    <select value={primary} onChange={(e) => setPrimary(emp.id, e.target.value)} style={selectSmall}>
                      <option value="">Select…</option>
                      {reviewersForThisEmployee.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.full_name ?? r.id}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td style={td}>
                    <select value={secondary} onChange={(e) => setSecondary(emp.id, e.target.value)} style={selectSmall}>
                      <option value="">(none)</option>
                      {reviewersForThisEmployee.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.full_name ?? r.id}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td style={td}>
                    <div style={{ display: "grid", gap: 6, maxHeight: 120, overflow: "auto", paddingRight: 6 }}>
                      {reviewersForThisEmployee.map((r) => (
                        <label key={r.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input type="checkbox" checked={peers.includes(r.id)} onChange={() => togglePeer(emp.id, r.id)} />
                          <span style={{ fontSize: 12 }}>{r.full_name ?? r.id}</span>
                        </label>
                      ))}
                    </div>
                  </td>

                  {/* Status */}
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontSize: 12, fontFamily: "monospace" }}>
                        Review: {meta ? reviewStatus : "-"}
                      </div>
                      <div style={{ fontSize: 12, fontFamily: "monospace" }}>
                        Released: {releasedAt ? new Date(releasedAt).toLocaleString() : "-"}
                      </div>
                    </div>
                  </td>

                  {/* Actions */}
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <div style={{ display: "grid", gap: 8 }}>
                      <button
                        onClick={() => assignForEmployee(emp.id)}
                        style={actionBtnStyle(true)}
                      >
                      Assign
                        </button>

                      <span title={!canRelease ? releaseTooltip : undefined} style={{ display: "inline-block" }}>
                        <button
                          onClick={() => releaseForEmployee(emp.id)}
                          disabled={!canRelease}
                          style={actionBtnStyle(canRelease)}
                        >
                        {isReleased ? "Released" : "Release"}
                        </button>
                      </span>

                      {meta ? (
                        <AdminReopenReviewButton
                          reviewId={meta.review_id}
                          disabled={!canReopen}
                          title={!canReopen ? reopenTooltip : "Reopen this committed review"}
                        />
                      ) : (
                        <span title="No primary review exists yet" style={{ display: "inline-block" }}>
                          <button
                            disabled
                            style={{
                              padding: "8px 12px",
                              borderRadius: 10,
                              border: "1px solid #ddd",
                              background: "white",
                              cursor: "not-allowed",
                              fontWeight: 700,
                              opacity: 0.55,
                              width: "fit-content",
                            }}
                          >
                            Reopen
                          </button>
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 18, fontSize: 12 }}>
        <BackToAdmin />
      </div>
    </div>
  </main>
);

}
const th: React.CSSProperties = {
  textAlign: "left",
  padding: 12,
  fontSize: 12,
  fontWeight: 900,
  color: "#0f172a",
  borderBottom: "1px solid #e2e8f0",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: 12,
  fontSize: 13,
  color: "#0f172a",
  verticalAlign: "top",
};

const tdStrong: React.CSSProperties = {
  ...td,
  fontWeight: 800,
};

const tdMono: React.CSSProperties = {
  ...td,
  fontFamily: "monospace",
  fontSize: 12,
  color: "#334155",
};

const selectSmall: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "white",
  width: 230,
  fontWeight: 700,
  color: "#0f172a",
};

const btnSmall: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "white",
  fontWeight: 800,
  cursor: "pointer",
  color: "#0f172a",
};
const actionBtn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
  fontWeight: 700,
  width: "fit-content",
};

function actionBtnStyle(enabled: boolean): React.CSSProperties {
  return {
    ...actionBtn,
    cursor: enabled ? "pointer" : "not-allowed",
    opacity: enabled ? 1 : 0.55,
  };
}
