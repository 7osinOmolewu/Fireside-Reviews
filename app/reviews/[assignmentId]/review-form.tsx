"use client";

import { useMemo, useState } from "react";
import type { AssignmentPayload, RubricCategoryRow } from "@/lib/types/reviews";

type ScoreRow = { key: string; label: string; score: number; weight: number | null };

export default function ReviewForm({
  assignment,
  rubricCategories,
}: {
  assignment: AssignmentPayload;
  rubricCategories: RubricCategoryRow[];
}) {
  const assignmentId = assignment.id;
  const reviewerType = assignment.reviewer_type;

  const existingReview = assignment.reviews?.[0] ?? null;
  const existingScoreRow = existingReview?.review_scores?.[0] ?? null;

  const existingCategoryScores: Record<string, number> =
    (existingScoreRow?.category_scores as Record<string, number> | null) ?? {};

  const [privateSummary, setPrivateSummary] = useState(
    existingReview?.summary_reviewer_private ?? ""
  );
  const [employeeSummary, setEmployeeSummary] = useState(
    existingReview?.summary_employee_visible ?? ""
  );
  const [saving, setSaving] = useState(false);

  const initialScoreRows: ScoreRow[] = useMemo(() => {
    return (rubricCategories ?? [])
      .filter((c) => c.is_scored !== false)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((c) => ({
        key: c.code, // stable key for category_scores
        label: c.name,
        weight: c.weight ?? null,
        score: Number(existingCategoryScores[c.code] ?? 0),
      }));
  }, [rubricCategories, existingReview?.id]);

  const [scoreRows, setScoreRows] = useState<ScoreRow[]>(initialScoreRows);

  async function saveNarrative(submit: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`/api/reviews/${assignmentId}/narrative`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary_reviewer_private: privateSummary,
          summary_employee_visible: employeeSummary,
          submit,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ? JSON.stringify(json.error) : "Failed");
      alert(submit ? "Submitted narrative." : "Saved draft.");
    } finally {
      setSaving(false);
    }
  }

  async function saveScores() {
    setSaving(true);
    try {
      const category_scores = Object.fromEntries(scoreRows.map((r) => [r.key, r.score]));

      const res = await fetch(`/api/reviews/${assignmentId}/scores`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_scores }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ? JSON.stringify(json.error) : "Failed");
      alert("Saved scores.");
    } finally {
      setSaving(false);
    }
  }

  const canScore = reviewerType === "primary";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Review</h1>

      <label style={{ display: "grid", gap: 8 }}>
        <div style={{ fontWeight: 700 }}>Reviewer Narrative (Private)</div>
        <textarea
          value={privateSummary}
          onChange={(e) => setPrivateSummary(e.target.value)}
          rows={10}
          style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
        />
      </label>

      <label style={{ display: "grid", gap: 8 }}>
        <div style={{ fontWeight: 700 }}>Employee Summary (Visible)</div>
        <textarea
          value={employeeSummary}
          onChange={(e) => setEmployeeSummary(e.target.value)}
          rows={6}
          style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
        />
      </label>

      <div style={{ display: "flex", gap: 8 }}>
        <button disabled={saving} onClick={() => saveNarrative(false)} style={btn}>
          Save Draft
        </button>
        <button disabled={saving} onClick={() => saveNarrative(true)} style={btnPrimary}>
          Submit Narrative
        </button>
      </div>

      {canScore && (
        <div style={{ borderTop: "1px solid #eee", paddingTop: 16, display: "grid", gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Scores (Primary only)</div>

          {scoreRows.length === 0 ? (
            <div style={{ opacity: 0.8 }}>
              No rubric categories available for scoring.
            </div>
          ) : (
            scoreRows.map((r, idx) => (
              <div key={r.key} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 360 }}>
                  <div style={{ fontWeight: 700 }}>{r.label}</div>
                  <div style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.7 }}>
                    {r.key}{r.weight != null ? ` (weight ${r.weight})` : ""}
                  </div>
                </div>

                <input
                  type="number"
                  value={r.score}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setScoreRows((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, score: v } : x))
                    );
                  }}
                  style={{ width: 120, padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
                />
              </div>
            ))
          )}

          <button disabled={saving || scoreRows.length === 0} onClick={saveScores} style={btnPrimary}>
            Save Scores
          </button>
        </div>
      )}
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #ddd",
  background: "white",
  cursor: "pointer",
};

const btnPrimary: React.CSSProperties = {
  ...btn,
  border: "1px solid #111",
  background: "#111",
  color: "white",
};
