"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyRole } from "@/lib/me";
import Link from "next/link";

export function BackToAdmin() {
  return (
    <Link href="/admin" style={{ textDecoration: "underline" }}>
      Admin
    </Link>
  );
}

type Cycle = { id: string; name: string; start_date: string; end_date: string; status: string };

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

  const [selectedCycleId, setSelectedCycleId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Loading...");

  // per-employee selection state
  const [primaryByEmployee, setPrimaryByEmployee] = useState<Record<string, string>>({});
  const [secondaryByEmployee, setSecondaryByEmployee] = useState<Record<string, string>>({});
  const [peersByEmployee, setPeersByEmployee] = useState<Record<string, string[]>>({});

  async function loadCycles() {
    const { data, error } = await supabase
      .from("review_cycles")
      .select("id,name,start_date,end_date,status")
      .order("start_date", { ascending: false });

    if (error) throw error;

    const list = (data ?? []) as Cycle[];
    setCycles(list);

    if (!selectedCycleId && list.length > 0) setSelectedCycleId(list[0].id);
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

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>
            <BackToAdmin /> · Assignments
          </h1>
        </div>

        <Link
          href="/admin/reviews"
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Next: Reviews →
        </Link>
      </div>

      <section style={{ marginTop: 12, padding: 16, border: "1px solid #ddd", borderRadius: 10 }}>
        <label style={{ display: "block" }}>
          <strong>Select cycle</strong>
          <select
            value={selectedCycleId}
            onChange={(e) => setSelectedCycleId(e.target.value)}
            style={{ display: "block", marginTop: 6, padding: 10, width: 520 }}
          >
            {cycleOptions.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <p style={{ marginTop: 10 }}>{status}</p>
        {error && <p style={{ marginTop: 8, color: "#b91c1c" }}>{error}</p>}
      </section>

      <section style={{ marginTop: 18 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Employee</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Employee Code</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Role</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Primary (required)</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Secondary (optional)</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Peers (optional)</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }} />
            </tr>
          </thead>

          <tbody>
            {employees.map((emp) => {
              const empName = emp.profiles?.full_name ?? "(no name)";
              const primary = primaryByEmployee[emp.id] ?? "";
              const secondary = secondaryByEmployee[emp.id] ?? "";
              const peers = peersByEmployee[emp.id] ?? [];

              const reviewersForThisEmployee = reviewers.filter((r) => r.id !== emp.id);

              return (
                <tr key={emp.id}>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <div style={{ fontWeight: 600 }}>{empName}</div>
                  </td>

                  <td style={{ borderBottom: "1px solid #eee", padding: 8, fontFamily: "monospace" }}>
                    {emp.employee_code ?? "-"}
                  </td>

                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{emp.job_roles?.name ?? "(none)"}</td>

                  {/* Primary */}
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <select value={primary} onChange={(e) => setPrimary(emp.id, e.target.value)} style={{ padding: 8, width: 240 }}>
                      <option value="">Select primary reviewer...</option>
                      {reviewersForThisEmployee.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.full_name ?? r.id}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Secondary */}
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <select value={secondary} onChange={(e) => setSecondary(emp.id, e.target.value)} style={{ padding: 8, width: 240 }}>
                      <option value="">(none)</option>
                      {reviewersForThisEmployee.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.full_name ?? r.id}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Peers */}
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <div style={{ display: "grid", gap: 6 }}>
                      {reviewersForThisEmployee.map((r) => (
                        <label key={r.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input type="checkbox" checked={peers.includes(r.id)} onChange={() => togglePeer(emp.id, r.id)} />
                          <span style={{ fontSize: 13 }}>{r.full_name ?? r.id}</span>
                        </label>
                      ))}
                    </div>
                  </td>

                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <button onClick={() => assignForEmployee(emp.id)} style={{ padding: "8px 12px" }}>
                      Assign
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ textDecoration: "underline", marginTop: 24 }}>
          Back to <BackToAdmin />
        </div>
      </section>
    </main>
  );
}
