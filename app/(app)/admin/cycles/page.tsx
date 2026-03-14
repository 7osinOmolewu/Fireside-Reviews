"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getMyRole } from "@/lib/me";

export function BackToAdmin() {
  return (
    <Link href="/admin" style={{ textDecoration: "underline" }}>
      Admin
    </Link>
  );
}

type Cycle = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: "draft" | "calibrating" | "finalized" | string;
};

type JobRole = { id: string; code: string; name: string };
type Rubric = { id: string; version: string; role_id: string; is_active: boolean };

type CycleRubricRow = {
  cycle_id: string;
  job_role_id: string;
  rubric_id: string;
};

const NEW_CYCLE_VALUE = "__NEW_CYCLE__";

export default function CyclesManagementPage() {
  const [isLoading, setIsLoading] = useState(true);

  const [prevCycleId, setPrevCycleId] = useState<string | null>(null);
  // mapping from previous cycle: job_role_id -> rubric_id
  const [prevMapping, setPrevMapping] = useState<Record<string, string>>({});

  const [error, setError] = useState<string | null>(null);

  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);

  const [selectedCycleId, setSelectedCycleId] = useState<string>("");

  const [globalActiveCycleId, setGlobalActiveCycleId] = useState<string | null>(null);
  const [settingGlobal, setSettingGlobal] = useState(false);

  // Create cycle form fields
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // mapping: job_role_id -> rubric_id for selected cycle
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);

  const selectedCycle = useMemo(
    () => cycles.find((c) => c.id === selectedCycleId) ?? null,
    [cycles, selectedCycleId]
  );

  const isSelectedCycleGlobalActive =
  !!globalActiveCycleId && !!selectedCycle?.id && selectedCycle.id === globalActiveCycleId;

  const isCreatingCycle = selectedCycleId === NEW_CYCLE_VALUE;

  function getPrevCycleId(allCycles: Cycle[], selectedId: string) {
    // cycles are already loaded/sorted by start_date DESC in loadCycles()
    const idx = allCycles.findIndex((c) => c.id === selectedId);
    if (idx === -1) return null;
    const prev = allCycles[idx + 1]; // next item is older cycle
    return prev?.id ?? null;
  }

  async function requireAdminClientSide() {
    const me = await getMyRole();
    if (!me) {
      window.location.href = "/login";
      return null;
    }
    if (me.role !== "admin") {
      window.location.href = "/";
      return null;
    }
    return me;
  }

  async function loadGlobalActiveCycle() {
    const res = await fetch("/api/admin/active-cycle", { method: "GET" });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error ?? "Failed to load active cycle");

    return json as { activeCycleId: string | null; updatedAt: string | null };
  }

  async function loadCycles(): Promise<Cycle[]> {
    const { data, error } = await supabase
      .from("review_cycles")
      .select("id,name,start_date,end_date,status")
      .order("start_date", { ascending: false });

    if (error) throw error;

    const list = (data ?? []) as Cycle[];
    setCycles(list);
    return list;
  }

  async function loadJobRoles() {
    const { data, error } = await supabase.from("job_roles").select("id,code,name").order("name");
    if (error) throw error;
    setJobRoles((data ?? []) as JobRole[]);
  }

  async function loadRubrics() {
    const { data, error } = await supabase
      .from("rubrics")
      .select("id, version, role_id, is_active")
      .order("id", { ascending: true });

    if (error) throw error;
    setRubrics((data ?? []) as Rubric[]);
  }

  async function loadCycleMapping(cycleId: string) {
    const { data, error } = await supabase
      .from("cycle_rubrics")
      .select("cycle_id,job_role_id,rubric_id")
      .eq("cycle_id", cycleId);

    if (error) throw error;

    const m: Record<string, string> = {};
    for (const row of (data ?? []) as CycleRubricRow[]) {
      m[row.job_role_id] = row.rubric_id;
    }
    setMapping(m);
  }

  const globalActiveCycleName = useMemo(() => {
    if (!globalActiveCycleId) return null;
    return cycles.find((c) => c.id === globalActiveCycleId)?.name ?? "Unknown";
  }, [globalActiveCycleId, cycles]);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        setIsLoading(true);

        const me = await requireAdminClientSide();
        if (!me) return;

        const [{ activeCycleId }, cyclesList] = await Promise.all([
          loadGlobalActiveCycle(),
          loadCycles(),
          loadJobRoles(),
          loadRubrics(),
        ]);

        setGlobalActiveCycleId(activeCycleId ?? null);

        // Prefer selecting the global active cycle on first load
        if (activeCycleId && cyclesList.some((c) => c.id === activeCycleId)) {
          setSelectedCycleId(activeCycleId);
        } else if (cyclesList.length > 0) {
          setSelectedCycleId(cyclesList[0].id);
        }
      } catch (e: any) {
        setError(e?.message ?? "Unknown error");
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedCycleId || cycles.length === 0) return;

    (async () => {
      setError(null);

      const prevId = getPrevCycleId(cycles, selectedCycleId);
      setPrevCycleId(prevId);

      // load selected cycle mapping
      const { data: curData, error: curErr } = await supabase
        .from("cycle_rubrics")
        .select("cycle_id,job_role_id,rubric_id")
        .eq("cycle_id", selectedCycleId);

      if (curErr) throw curErr;

      const curMap: Record<string, string> = {};
      for (const row of (curData ?? []) as CycleRubricRow[]) {
        curMap[row.job_role_id] = row.rubric_id;
      }
      setMapping(curMap);

      // load previous cycle mapping (if any)
      if (!prevId) {
        setPrevMapping({});
        return;
      }

      const { data: prevData, error: prevErr } = await supabase
        .from("cycle_rubrics")
        .select("cycle_id,job_role_id,rubric_id")
        .eq("cycle_id", prevId);

      if (prevErr) throw prevErr;

      const prevMap: Record<string, string> = {};
      for (const row of (prevData ?? []) as CycleRubricRow[]) {
        prevMap[row.job_role_id] = row.rubric_id;
      }
      setPrevMapping(prevMap);
    })().catch((e: any) => setError(e.message ?? "Failed to load cycle forms"));
  }, [selectedCycleId, cycles]);

  const cycleOptions = useMemo(() => cycles.map((c) => ({ value: c.id, label: c.name })), [cycles]);

  function rubricsForRole(roleId: string) {
    return rubrics.filter((r) => r.role_id === roleId);
  }

  function getTemplateStatus(roleId: string) {
    if (selectedCycleId === NEW_CYCLE_VALUE) return "";

    const assignedRubricId = mapping[roleId];
    if (!assignedRubricId) return "Missing";

    const r = rubrics.find((x) => x.id === assignedRubricId);
    if (!r) return "Unknown rubric";
    if (!r.is_active) return "Inactive";
    return "Assigned";
  }

  async function onChangeRubric(roleId: string, rubricId: string) {
    if (!selectedCycleId || selectedCycleId === NEW_CYCLE_VALUE) return;

    setMapping((prev) => ({ ...prev, [roleId]: rubricId }));
    setSavingRoleId(roleId);
    setError(null);

    try {
      const { error } = await supabase.from("cycle_rubrics").upsert(
        {
          cycle_id: selectedCycleId,
          job_role_id: roleId,
          rubric_id: rubricId,
        },
        { onConflict: "cycle_id,job_role_id" }
      );

      if (error) throw error;
    } catch (e: any) {
      setError(e?.message ?? "Failed to save mapping");
      await loadCycleMapping(selectedCycleId);
    } finally {
      setSavingRoleId(null);
    }
  }

  async function createCycle(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const me = await requireAdminClientSide();
    if (!me) return;

    const trimmedName = name.trim();
    if (!trimmedName) return setError("Cycle name is required.");
    if (!startDate) return setError("Start date is required.");
    if (!endDate) return setError("End date is required.");

    const { data, error } = await supabase
      .from("review_cycles")
      .insert([
        {
          name: trimmedName,
          start_date: startDate,
          end_date: endDate,
          status: "draft",
          created_by: me.userId,
        },
      ])
      .select("id")
      .single();

    if (error) {
      setError(error.message);
      return;
    }

    setName("");
    setStartDate("");
    setEndDate("");

    // Reload cycles and select the newly created one
    await loadCycles();
    if (data?.id) setSelectedCycleId(data.id);
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, marginTop: 24 }}>
            <BackToAdmin />· Manage Cycles
          </h1>
        </div>

        <Link
          href="/admin/employees"
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Next: Employees →
        </Link>
      </div>

      {/* Only show Loading while loading, no “Ready” */}
      {isLoading && <p style={{ marginTop: 10 }}>Loading…</p>}
      {error && <p style={{ marginTop: 10, color: "#b91c1c" }}>{error}</p>}

      {/* Selected cycle + right panel */}
      <section style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Left: selector */}
        <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 10 }}>
          <h2 style={{ marginTop: 0, marginBottom: 10 }}>
            <strong>Selected cycle</strong>
          </h2>

          <select
            value={selectedCycleId}
            onChange={(e) => setSelectedCycleId(e.target.value)}
            style={{ display: "block", padding: 10, width: "100%" }}
          >
            {cycleOptions.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}

            {/* Only show if cycles exist, but fine either way */}
            <option value={NEW_CYCLE_VALUE}>Create new cycle…</option>
          </select>

          {/* Global active + Set current (moved here from Cycle details) */}
          {!isCreatingCycle && selectedCycle ? (
            <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                <strong> Current Performance Cycle:</strong> 
                <span
                  style={{ marginLeft: 6, fontWeight: 700 }}
                  title={globalActiveCycleId ?? undefined}
                >
                  {globalActiveCycleName ?? "none"}
                </span>
              </div>

              {isSelectedCycleGlobalActive ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: "#065f46" }}> </span>
              ) : (
                <button
                  type="button"
                  disabled={settingGlobal || !selectedCycle?.id}
                  onClick={async () => {
                    if (!selectedCycle?.id) return;
                    setSettingGlobal(true);
                    setError(null);

                    try {
                      const res = await fetch("/api/admin/active-cycle", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ cycleId: selectedCycle.id }),
                      });

                      const json = await res.json().catch(() => ({}));
                      if (!res.ok) {
                        setError(json?.error ?? "Failed to set active cycle");
                        return;
                      }

                      setGlobalActiveCycleId(selectedCycle.id);
                    } finally {
                      setSettingGlobal(false);
                    }
                  }}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid #111827",
                    background: "#111827",
                    color: "white",
                    fontWeight: 700,
                    cursor: settingGlobal ? "not-allowed" : "pointer",
                    opacity: settingGlobal ? 0.7 : 1,
                  }}
                >
                  {settingGlobal ? "Setting…" : "Set to Current Cycle"}
                </button>
              )}
            </div>
          ) : null}

         
          {isCreatingCycle && (
            <p style={{ marginTop: 10, opacity: 0.8 }}>
              Create a new cycle. It will start as <span style={{ fontFamily: "monospace" }}>draft</span>.
            </p>
          )}
        </div>

        {/* Right: details or create form */}
        <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 10 }}>
          {!isCreatingCycle && selectedCycle && (
            <>
              <h2 style={{ marginTop: 0, marginBottom: 10 }}>
                <strong>Cycle details</strong>
              </h2>

              <div style={{ display: "grid", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Name</div>
                  <div style={{ fontWeight: 600 }}>{selectedCycle.name}</div>
                </div>

                <div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Dates</div>
                  <div>
                    {selectedCycle.start_date} → {selectedCycle.end_date}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Status</div>
                  <div style={{ textTransform: "lowercase" }}>{selectedCycle.status}</div>
                </div>

                <div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Templates mapped</div>
                  <div>{jobRoles.length === 0 ? "0" : `${Object.keys(mapping).length}/${jobRoles.length}`}</div>
                </div>
              </div>
            </>
          )}

          {isCreatingCycle && (
            <>
              <h2 style={{ marginTop: 0, marginBottom: 10 }}>Create cycle</h2>

              <form onSubmit={createCycle} style={{ display: "grid", gap: 10 }}>
                <label>
                  Cycle name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    style={{ width: "100%", padding: 10, marginTop: 6 }}
                  />
                </label>

                <label>
                  Start date
                  <input
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    type="date"
                    required
                    style={{ width: "100%", padding: 10, marginTop: 6 }}
                  />
                </label>

                <label>
                  End date
                  <input
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    type="date"
                    required
                    style={{ width: "100%", padding: 10, marginTop: 6 }}
                  />
                </label>

                <button type="submit" style={{ padding: "10px 14px", width: "fit-content" }}>
                  Create
                </button>
              </form>
            </>
          )}
        </div>
      </section>

      {/* Cycle Form Templates */}
      <section style={{ marginTop: 18 }}>
        {selectedCycleId && (
          <div style={{ marginBottom: 12 }}>
            <strong>
              Templates for Cycle:&nbsp;{cycles.find((c) => c.id === selectedCycleId)?.name}
            </strong>
          </div>
        )}

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Job Family</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Assigned Template</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Status</th>
            </tr>
          </thead>

          <tbody>
            {jobRoles.map((jr) => {
              const options = rubricsForRole(jr.id);
              const value = mapping[jr.id] ?? "";
              const saving = savingRoleId === jr.id;

              const cur = mapping[jr.id] ?? "";
              const prev = prevMapping[jr.id] ?? "";

              let computedStatus = "";
              if (!prevCycleId) {
                computedStatus = cur ? "Base" : "Unassigned";
              } else if (!cur) {
                computedStatus = "Unassigned";
              } else if (cur === prev) {
                computedStatus = "Inherited";
              } else {
                computedStatus = "Customized";
              }

              return (
                <tr key={jr.id}>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <div style={{ fontWeight: 600 }}>{jr.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{jr.code}</div>
                  </td>

                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <select
                      value={value}
                      onChange={(e) => onChangeRubric(jr.id, e.target.value)}
                      style={{ padding: 10, width: 420 }}
                      disabled={!selectedCycleId || isCreatingCycle}
                    >
                      <option value="">Select a rubric…</option>
                      {options.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.id} ({r.version}) {r.is_active ? "" : "(inactive)"}
                        </option>
                      ))}
                    </select>

                    {options.length === 0 && (
                      <div style={{ marginTop: 6, fontSize: 12, color: "#b45309" }}>
                        No rubrics found for this role yet.
                      </div>
                    )}
                  </td>

                  <td style={{ borderBottom: "1px solid #eee", padding: 8, width: 140 }}>
                    {saving ? "Saving..." : computedStatus}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p
          style={{
            marginTop: 0,
            opacity: 0.85,
            fontWeight: 600,
            fontStyle: "italic",
          }}
        >
          Assign which rubric/template each Job Family uses for the selected cycle. New cycles default to the previous
          cycle’s assignments.
        </p>

        <div style={{ marginTop: 24, textDecoration: "underline" }}>
          Back to <BackToAdmin />
        </div>
      </section>
    </main>
  );
}
