"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyRole } from "@/lib/me";

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

export default function EmployeePage() {
  const [state, setState] = useState<string>("Loading...");
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<PublicSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inboxCount, setInboxCount] = useState<number>(0);

  const currentCycleLabel = useMemo(() => {
    const first = summaries?.[0];
    if (!first) return null;
    return first.review_cycles?.name ?? first.cycle_id;
  }, [summaries]);

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

        // Load finalized summaries (employee-visible)
        const { data, error: qErr } = await supabase
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
          


        if (qErr) throw qErr;

        setSummaries((data ?? []) as PublicSummary[]);

        // Count review inbox assignments (reviews user needs to write for others)
        const { count, error: countErr } = await supabase
          .from("review_assignments")
          .select("id", { count: "exact", head: true })
          .eq("reviewer_id", user.id);

        if (!countErr) setInboxCount(count ?? 0);
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
          <h1 style={{ margin: 0 }}>Employee</h1>
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

      {!error && loading && (
        <div style={{ opacity: 0.8 }}>Loading finalized summaries…</div>
      )}

      {!error && !loading && summaries.length === 0 && (
        <div style={{ opacity: 0.8 }}>No finalized review summaries yet.</div>
      )}

      {!error && !loading && summaries.length > 0 && (
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
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>Finalized Summary</div>
                  <div style={{ fontSize: 13, opacity: 0.75 }}>
                    Rating: {s.performance_rating ?? "—"}
                  </div>
                </div>

                {narrative ? (
                  <p
                    style={{
                      marginTop: 10,
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.5,
                    }}
                  >
                    {narrative}
                  </p>
                ) : (
                  <p style={{ marginTop: 10, opacity: 0.75 }}>
                    No employee-visible narrative was published.
                  </p>
                )}

                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65 }}>
                  Cycle: {cycleLabel}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
