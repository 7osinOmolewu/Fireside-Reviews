"use client";

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

type OpenCycle = { id: string; name: string; status: string };

export default function EmployeePage() {
  const [state, setState] = useState<string>("Loading...");
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<PublicSummary[]>([]);
  const [currentCycleSummaries, setCurrentCycleSummaries] = useState<CurrentCycleSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inboxCount, setInboxCount] = useState<number>(0);
  const [cycleLabel, setCycleLabel] = useState<string>("Loading...");

  const currentCycleLabel = useMemo(() => {
    const cur = currentCycleSummaries?.[0];
    if (cur) return cur.review_cycles?.name ?? cur.cycle_id;

    const released = summaries?.[0];
    if (released) return released.review_cycles?.name ?? released.cycle_id;

    return null;
  }, [currentCycleSummaries, summaries]);

  useEffect(() => {
    (async () => {
      const me = await getMyRole();
      if (!me) {
        window.location.href = "/login";
        return;
      }

      setState(`Employee view: ${me.fullName}`);

      try {
        const { data: authRes, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const user = authRes?.user;
        if (!user) {
          window.location.href = "/login";
          return;
        }

        // 0) Fetch open cycles (calibrating) so inbox count is per current cycle(s)
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
        
        // 1) Load current cycle summary rows (released or not)
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

        // 2) Load released summaries (employee-visible history)
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

        // 3) Count review inbox assignments for open cycle(s) only (and active only)
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
        setError(e?.message ?? "Failed to load employee summary.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  
  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 900 }}>
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
        
           
          <h1 
            style={{ fontSize: 26, fontWeight: 900, margin: 0, letterSpacing: -0.2 }}>
              Employee 
          <span style={{ fontSize: 22, color: "#6b7280", fontWeight: 850 }}> ({cycleLabel})</span>
          </h1>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>{state}</div>

          {currentCycleLabel && (
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.65 }}>
              Current cycle: {currentCycleLabel}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a
            href="/reviews"
            style={{
              padding: "6px 10px",
              fontSize: 13,
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
              textDecoration: "none",
              color: "inherit",
              display: "inline-flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            My Review Inbox
            <span
              style={{
                fontSize: 12,
                padding: "1px 8px",
                borderRadius: 999,
                border: "1px solid #ddd",
                opacity: 0.85,
              }}
            >
              {inboxCount}
            </span>
          </a>

          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              style={{
                padding: "6px 10px",
                fontSize: 13,
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "white",
                cursor: "pointer",
              }}
            >
              Log out
            </button>
          </form>
        </div>
      </div>

      {/* Body */}
      {error && (
        <div
          style={{
            padding: 12,
            border: "1px solid #f2b8b5",
            borderRadius: 12,
            background: "#fff5f5",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Error</div>
          <div style={{ fontSize: 13 }}>{error}</div>
        </div>
      )}

      {!error && loading && <div style={{ opacity: 0.8 }}>Loading employee view…</div>}

      {!error && !loading && (
        <>
          {/* Current cycle status */}
          {currentCycleSummaries.length > 0 && (
            <section style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
                Current cycle
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {currentCycleSummaries.map((s) => {
                  const cycleLabel = s.review_cycles?.name ?? s.cycle_id;

                  const isReleased = Boolean(s.released_at);
                  const isFinalized = Boolean(s.finalized_at);

                  const statusText = isReleased
                    ? "Released"
                    : isFinalized
                    ? "Finalized (not released yet)"
                    : "In progress";

                  return (
                    <div
                      key={s.id}
                      style={{
                        border: "1px solid #eee",
                        borderRadius: 14,
                        padding: 16,
                        background: "white",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "flex-start",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800 }}>{cycleLabel}</div>
                        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
                          Status: {statusText}
                        </div>

                        {!isReleased && (
                          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.7 }}>
                            Your rating and narrative will appear here once released by Admin.
                          </div>
                        )}

                        {isReleased && (
                          <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.5 }}>
                            <div style={{ fontWeight: 700 }}>
                              Rating: {s.performance_rating ?? "—"}
                            </div>
                            <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                              {s.final_narrative_employee_visible ?? "—"}
                            </div>
                          </div>
                        )}
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 10px",
                            borderRadius: 999,
                            border: "1px solid #e5e7eb",
                            background: isReleased ? "#ecfdf5" : "#f9fafb",
                            fontSize: 12,
                            fontWeight: 800,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {statusText}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Released summaries */}
          {summaries.length === 0 ? (
            <div style={{ opacity: 0.8 }}>No released review summaries yet.</div>
          ) : (
            <section>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
                Released summaries
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                {summaries.map((s) => {
                  const narrative = s.final_narrative_employee_visible ?? "";
                  const cycleLabel = s.review_cycles?.name ?? s.cycle_id;

                  return (
                    <div
                      key={s.id}
                      style={{
                        border: "1px solid #eee",
                        borderRadius: 14,
                        padding: 16,
                        background: "white",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ fontWeight: 800 }}>{cycleLabel}</div>
                        <div style={{ fontSize: 13, opacity: 0.75 }}>
                          Rating: {s.performance_rating ?? "—"}
                        </div>
                      </div>

                      {narrative ? (
                        <p style={{ marginTop: 10, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                          {narrative}
                        </p>
                      ) : (
                        <p style={{ marginTop: 10, opacity: 0.75 }}>
                          No employee-visible narrative was published.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
