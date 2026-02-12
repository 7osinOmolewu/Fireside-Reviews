"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AssignmentPayload, RubricCategoryRow } from "@/lib/types/reviews";

type ScoreRow = { key: string; label: string; score: number; weight: number | null };

const SCORE_MIN = 0;
const SCORE_MAX = 100;

function asSingle<T>(v: any): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] as T) : (v as T);
}

function safeString(v: any): string {
  return typeof v === "string" ? v : "";
}

export default function ReviewForm({
  assignment,
  rubricCategories,
  pendingAssignmentIds,
  isPending,
  cycleLabel,
  cycleQS,
  isAdmin,
  releasedAt,
}: {
  assignment: AssignmentPayload;
  rubricCategories: RubricCategoryRow[];
  pendingAssignmentIds: string[];
  isPending: boolean;
  cycleLabel: string;
  cycleQS: string;
  isAdmin: boolean;
  releasedAt: string | null;
}) {
  const router = useRouter();

  const assignmentId = assignment.id;
  const reviewerType = assignment.reviewer_type;

  const employeeRow = asSingle<any>((assignment as any).employees);
  const profileRow = asSingle<any>(employeeRow?.profiles);
  const employeeName = profileRow?.full_name?.trim() || profileRow?.email || "Employee";

  const existingReview: any = (assignment as any).reviews?.[0] ?? null;
  const reviewStatus = (existingReview?.status ?? "draft") as "draft" | "submitted";
  const isLocked = reviewStatus === "submitted";

  const [shareWithEmployee, setShareWithEmployee] = useState<boolean>(
    Boolean((existingReview as any)?.narrative_share_with_employee)
  );
  const canToggleShare = isAdmin && reviewStatus === "submitted" && !releasedAt;

  const [toggling, setToggling] = useState(false);

  const existingScoreRow: any = existingReview?.review_scores?.[0] ?? null;
  const existingCategoryScores: Record<string, number> =
    (existingScoreRow?.category_scores as Record<string, number> | null) ?? {};

  const canScore = reviewerType === "primary";

  const scoresFingerprint = useMemo(() => {
    try {
      return JSON.stringify(existingScoreRow?.category_scores ?? {});
    } catch {
      return "{}";
    }
  }, [existingScoreRow]);

  const computedInitialScoreRows: ScoreRow[] = useMemo(() => {
    return (rubricCategories ?? [])
      .filter((c) => c.is_scored !== false)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((c) => {
        const raw = Number(existingCategoryScores[c.code] ?? 0);
        const clamped = Number.isFinite(raw)
          ? Math.min(SCORE_MAX, Math.max(SCORE_MIN, raw))
          : SCORE_MIN;

        return { key: c.code, label: c.name, weight: c.weight ?? null, score: clamped };
      });
  }, [rubricCategories, scoresFingerprint]);

  const initialScoreMapRef = useRef<Record<string, number>>({});
  const initialNarrativeRef = useRef<string>("");

  const [narrative, setNarrative] = useState(
    safeString(existingReview?.summary_employee_visible)
  );
  const [scoreRows, setScoreRows] = useState<ScoreRow[]>(computedInitialScoreRows);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // seed initial refs once
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;

    initialNarrativeRef.current =
     safeString(existingReview?.summary_employee_visible);

    initialScoreMapRef.current = Object.fromEntries(
      computedInitialScoreRows.map((r) => [r.key, r.score])
    );
  }, [existingReview, computedInitialScoreRows]);

  const isDirty = useMemo(() => {
    if (saving) return false;
    if (isLocked) return false;

    if (narrative !== initialNarrativeRef.current) return true;

    const initMap = initialScoreMapRef.current;
    for (const r of scoreRows) {
      const init = Number(initMap[r.key] ?? SCORE_MIN);
      if (Number(r.score ?? SCORE_MIN) !== init) return true;
    }
    return false;
  }, [narrative, scoreRows, saving, isLocked]);

  const isNarrativeDirty = useMemo(() => {
    if (saving) return false;
    if (isLocked) return false;
    return narrative !== initialNarrativeRef.current;
  }, [narrative, saving, isLocked]);

  const isScoresDirty = useMemo(() => {
    if (saving) return false;
    if (isLocked) return false;
    if (!canScore) return false;

    const initMap = initialScoreMapRef.current;
    for (const r of scoreRows) {
      const init = Number(initMap[r.key] ?? SCORE_MIN);
      if (Number(r.score ?? SCORE_MIN) !== init) return true;
    }
    return false;
  }, [scoreRows, saving, isLocked, canScore]);

  // Rehydrate when server snapshot changes, but don't wipe local edits
  const lastHydrateKeyRef = useRef<string>("");

  const hydrateKey = useMemo(() => {
    const rid = String(existingReview?.id ?? "");
    const nar = safeString(existingReview?.summary_employee_visible);
    const share = String(Boolean((existingReview as any)?.narrative_share_with_employee));
    return `${assignmentId}|${rid}|${nar}|${share}|${scoresFingerprint}|${reviewStatus}`;
  }, [
    assignmentId,
    existingReview?.id,
    existingReview?.summary_employee_visible,
    (existingReview as any)?.narrative_share_with_employee,
    scoresFingerprint,
    reviewStatus,
  ]);

  useEffect(() => {
    if (hydrateKey === lastHydrateKeyRef.current) return;

    const nextNarrative =
      safeString(existingReview?.summary_employee_visible);

    const nextScores = computedInitialScoreRows;

    const nextShare = Boolean(existingReview?.narrative_share_with_employee);
      setShareWithEmployee(nextShare);

    // guard: if user typed and incoming is empty, don't wipe
    const incomingHasAny = nextNarrative.trim().length > 0;
    if (isDirty && !incomingHasAny) return;

    setNarrative(nextNarrative);
    setScoreRows(nextScores);

    initialNarrativeRef.current = nextNarrative;
    initialScoreMapRef.current = Object.fromEntries(nextScores.map((r) => [r.key, r.score]));

    lastHydrateKeyRef.current = hydrateKey;
    setErrorMsg(null);
  }, [hydrateKey, computedInitialScoreRows, existingReview, isDirty]);

  const nav = useMemo(() => {
    const ids = pendingAssignmentIds ?? [];
    const idx = ids.indexOf(assignmentId);

    const prevId = idx > 0 ? ids[idx - 1] : null;
    const nextId = idx >= 0 && idx < ids.length - 1 ? ids[idx + 1] : null;

    return { idx, prevId, nextId, position: idx >= 0 ? idx + 1 : null, total: ids.length };
  }, [pendingAssignmentIds, assignmentId]);

  function confirmLeave(): boolean {
    if (!isDirty) return true;
    return window.confirm("You have unsaved changes. Leave this review without saving?");
  }

  function guardedPush(href: string) {
    if (!confirmLeave()) return;
    router.push(href);
  }

  const validation = useMemo(() => {
    const missing: string[] = [];
    if (!narrative.trim()) missing.push("Narrative");

    if (canScore) {
      const scoredCats = (rubricCategories ?? []).filter((c) => c.is_scored !== false);
      if (scoredCats.length > 0) {
        for (const r of scoreRows) {
          const v = Number(r.score);
          if (!Number.isFinite(v)) missing.push(`Score: ${r.label}`);
          else if (v < SCORE_MIN || v > SCORE_MAX)
            missing.push(`Score range: ${r.label} (${SCORE_MIN}-${SCORE_MAX})`);
        }
      }
    }

    return { missing, ok: missing.length === 0 };
  }, [narrative, canScore, rubricCategories, scoreRows]);

  function confirmCommit(): boolean {
    if (!validation.ok) {
      window.alert(
        "Cannot commit yet. Please complete the following:\n\n" +
          validation.missing.map((m) => `• ${m}`).join("\n")
      );
      return false;
    }

    return window.confirm(
      "Commit this review?\n\nThis will lock both the narrative and scores. You will not be able to edit after commit."
    );
  }

  async function saveNarrativeOnly() {
    setSaving(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/reviews/${assignmentId}/narrative`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ narrative, submit: false })
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          json?.error?.message ??
          json?.message ??
          (typeof json?.error === "string" ? json.error : null) ??
          "Failed";
        setErrorMsg(msg);
        return;
      }

      initialNarrativeRef.current = narrative;
      window.alert("Saved narrative.");
      // no router.refresh() here on purpose
    } finally {
      setSaving(false);
    }
  }

  async function saveScoresOnly() {
    if (!canScore) return;

    setSaving(true);
    setErrorMsg(null);

    try {
      const category_scores = Object.fromEntries(scoreRows.map((r) => [r.key, r.score]));

      const res = await fetch(`/api/reviews/${assignmentId}/scores`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_scores }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          json?.error?.message ??
          json?.message ??
          (typeof json?.error === "string" ? json.error : null) ??
          "Failed";
        setErrorMsg(msg);
        return;
      }

      initialScoreMapRef.current = Object.fromEntries(scoreRows.map((r) => [r.key, r.score]));
      window.alert("Saved scores.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function commitReview() {
    if (isLocked) return;
    if (!confirmCommit()) return;

    setSaving(true);
    setErrorMsg(null);

    try {
      if (canScore) {
        const category_scores = Object.fromEntries(scoreRows.map((r) => [r.key, r.score]));
        const scoreRes = await fetch(`/api/reviews/${assignmentId}/scores`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category_scores }),
        });

        const scoreJson = await scoreRes.json().catch(() => ({}));
        if (!scoreRes.ok) {
          const msg =
            scoreJson?.error?.message ??
            scoreJson?.message ??
            (typeof scoreJson?.error === "string" ? scoreJson.error : null) ??
            "Failed saving scores.";
          setErrorMsg(msg);
          return;
        }
      }

      const narRes = await fetch(`/api/reviews/${assignmentId}/narrative`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ narrative, submit: true }),
      });

      const narJson = await narRes.json().catch(() => ({}));
      if (!narRes.ok) {
        const msg =
          narJson?.error?.message ??
          narJson?.message ??
          (typeof narJson?.error === "string" ? narJson.error : null) ??
          "Failed committing review.";
        setErrorMsg(msg);
        return;
      }

      initialNarrativeRef.current = narrative;
      initialScoreMapRef.current = Object.fromEntries(scoreRows.map((r) => [r.key, r.score]));

      window.alert("Committed. This review is now locked.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleShare(next: boolean) {
    if (!canToggleShare) return;
    
    setToggling(true);
    
    // optimistic update o it flips instantly
    setShareWithEmployee(next);

    try {
      const res = await fetch(
        `/api/reviews/${assignmentId}/share-narrative`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ share: next }),
        }
      );

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Failed to update share setting");
      }
      } catch (err: any) {
        // rollback on failure
        setShareWithEmployee((prev) => !prev);
        setErrorMsg(err?.message || "Failed to update share setting");
      } finally {
        setToggling(false);
      }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Header / nav */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 12,
          background: "white",
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (!isPending || !nav.prevId) return;
            guardedPush(`/reviews/${nav.prevId}${cycleQS}`);
          }}
          disabled={!isPending || !nav.prevId}
          style={{ ...btn, opacity: isPending && nav.prevId ? 1 : 0.4 }}
          aria-label="Previous pending review"
          title="Previous pending review"
        >
          ←
        </button>

        <div
          style={{
            flex: 1,
            textAlign: "center",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={`Reviewing ${employeeName}`}
        >
          <div style={{ fontSize: 28, fontWeight: 800, color: "#111827", lineHeight: 1.1 }}>
            Reviewing {employeeName}{" "}
            <span style={{ fontSize: 24, fontWeight: 900, color: "#6b7280" }}>({cycleLabel})</span>
          </div>

          {isPending && nav.position && nav.total ? (
            <div style={{ marginTop: 2, fontSize: 12, fontWeight: 700, color: "#6b7280" }}>
              ({nav.position} of {nav.total})
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" onClick={() => guardedPush(`/reviews${cycleQS}`)} style={btn}>
            Exit
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isPending || !nav.nextId) return;
              guardedPush(`/reviews/${nav.nextId}${cycleQS}`);
            }}
            disabled={!isPending || !nav.nextId}
            style={{ ...btn, opacity: isPending && nav.nextId ? 1 : 0.4 }}
            aria-label="Next pending review"
            title="Next pending review"
          >
            →
          </button>
        </div>
      </div>

      {/* Narrative */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800 }}>Narrative</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Save anytime. Commit locks both narrative and scores.</div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {isAdmin && (
              <label
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  fontSize: 12,
                  fontWeight: 800,
                  opacity: 0.85,
                }}
                title={
                  releasedAt
                    ? "Cannot change after cycle is released to the employee"
                    : reviewStatus !== "submitted"
                    ? "Admin can toggle after submit"
                    : "Toggle narrative visibility"
                }
              >
                Share with employee
                <input
                  type="checkbox"
                  checked={shareWithEmployee}
                  disabled={saving || toggling || !canToggleShare}
                  onChange={(e) => handleToggleShare(e.target.checked)}
                />
              </label>
            )}

            <button
              disabled={saving || isLocked || !isNarrativeDirty}
              onClick={saveNarrativeOnly}
              style={
                saving || isLocked || !isNarrativeDirty
                  ? btnPrimaryDisabled
                  : { ...btnPrimary, boxShadow: "0 0 0 3px rgba(0,0,0,0.08)" }
              }
              title={
                isLocked
                  ? "This review is committed and locked"
                  : !isNarrativeDirty
                  ? "No narrative changes to save"
                  : "Save narrative"
              }
            >
              Save Narrative
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <textarea
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            rows={14}
            disabled={saving || isLocked}
            style={textareaStyle(isLocked)}
          />
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            Visible to the employee only if Admin enables “Share with employee” and the cycle is released.
          </div>
        </div>
      </div>

      {/* Scores */}
      {canScore && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 800 }}>Scores</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Required for Commit. Range {SCORE_MIN}–{SCORE_MAX}.
              </div>
            </div>

            <button
              disabled={saving || isLocked || scoreRows.length === 0 || !isScoresDirty}
              onClick={saveScoresOnly}
              style={saving || isLocked || scoreRows.length === 0 || !isScoresDirty ? btnPrimaryDisabled : btnPrimary}
              title={
                isLocked
                  ? "This review is committed and locked"
                  : scoreRows.length === 0
                  ? "No rubric categories available"
                  : !isScoresDirty
                  ? "No score changes to save"
                  : "Save scores"
              }
            >
              Save Scores
            </button>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {scoreRows.length === 0 ? (
              <div style={{ opacity: 0.8 }}>No rubric categories available for scoring.</div>
            ) : (
              scoreRows.map((r, idx) => (
                <div key={r.key} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 360 }}>
                    <div style={{ fontWeight: 700 }}>{r.label}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.7 }}>
                      {r.key}
                      {r.weight != null ? ` (weight ${r.weight})` : ""}
                    </div>
                  </div>

                  <input
                    type="number"
                    min={SCORE_MIN}
                    max={SCORE_MAX}
                    step={1}
                    value={r.score}
                    disabled={saving || isLocked}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      const v = Number.isFinite(raw)
                        ? Math.min(SCORE_MAX, Math.max(SCORE_MIN, raw))
                        : SCORE_MIN;

                      setScoreRows((prev) => prev.map((x, i) => (i === idx ? { ...x, score: v } : x)));
                    }}
                    style={{
                      width: 140,
                      padding: 10,
                      borderRadius: 12,
                      border: "1px solid #ddd",
                      opacity: isLocked ? 0.75 : 1,
                    }}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            marginTop: 6,
            padding: 12,
            borderRadius: 10,
            border: "1px solid #fca5a5",
            background: "#fef2f2",
            color: "#991b1b",
            fontSize: 13,
            whiteSpace: "pre-wrap",
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Commit */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginTop: 8,
          paddingTop: 8,
          borderTop: "1px solid #eee",
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {isLocked
            ? "This review is committed and locked."
            : validation.ok
            ? "Ready to commit when you are."
            : "Complete required fields to enable Commit."}
        </div>

        <button
          type="button"
          disabled={saving || isLocked || !validation.ok}
          onClick={commitReview}
          style={saving || isLocked || !validation.ok ? btnPrimaryDisabled : btnPrimary}
          title={!validation.ok ? "Fill required fields to commit" : "Commit review"}
        >
          Commit Review →
        </button>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid #ddd",
  background: "white",
  cursor: "pointer",
  fontWeight: 600,
};

const btnPrimary: React.CSSProperties = {
  ...btn,
  background: "#000",
  border: "1px solid #000",
  color: "#fff",
};

const btnPrimaryDisabled: React.CSSProperties = {
  ...btnPrimary,
  opacity: 0.45,
  cursor: "not-allowed",
};

const card: React.CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 12,
  padding: 14,
  background: "white",
};

function textareaStyle(isLocked: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "1px solid #ddd",
    opacity: isLocked ? 0.75 : 1,
  };
}
