"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AssignmentPayload, RubricCategoryRow } from "@/lib/types/reviews";

type ScoreRow = { key: string; label: string; score: number; weight: number | null };

const SCORE_MIN = 0;
const SCORE_MAX = 100;

  function cn(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(" ");
  }

  function asSingle<T>(v: any): T | null {
    if (!v) return null;
    return Array.isArray(v) ? (v[0] as T) : (v as T);
  }

  function safeString(v: any): string {
    return typeof v === "string" ? v : "";
  }

  function Badge({
    label,
    tone = "neutral",
    title,
  }: {
    label: string;
    tone?: "neutral" | "success" | "warning";
    title?: string;
  }) {
    const toneClasses: Record<string, string> = {
      neutral: "bg-slate-50 text-slate-700 ring-slate-200",
      success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      warning: "bg-amber-50 text-amber-800 ring-amber-200",
    };

    return (
      <span
        title={title}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
          toneClasses[tone] ?? toneClasses.neutral
        )}
      >
        {label}
      </span>
    );
  }

  function Toggle({
    checked,
    disabled,
    onChange,
    label,
    hint,
  }: {
    checked: boolean;
    disabled: boolean;
    onChange: (v: boolean) => void;
    label: string;
    hint?: string;
  }) {
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{label}</div>
          {hint ? <div className="mt-0.5 text-xs text-slate-600">{hint}</div> : null}
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={cn(
            "relative inline-flex h-6 w-11 flex-none items-center rounded-full border transition",
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
            checked ? "bg-emerald-600 border-emerald-600" : "bg-slate-200 border-slate-300"
          )}
          aria-pressed={checked}
          aria-label={label}
        >
          <span
            className={cn(
              "inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition",
              checked ? "translate-x-5" : "translate-x-0.5"
            )}
          />
        </button>
      </div>
    );
  }

  export default function ReviewForm({
    assignment,
    rubricCategories,
    cycleLabel,
    cycleQS,
    isAdmin,
    releasedAt,
    onDirtyChange,
  }: {
    assignment: AssignmentPayload;
    rubricCategories: RubricCategoryRow[];
    cycleLabel: string;
    cycleQS: string;
    isAdmin: boolean;
    releasedAt: string | null;
    onDirtyChange?: (dirty: boolean) => void;
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

  const [narrative, setNarrative] = useState(safeString(existingReview?.summary_employee_visible));
  const [scoreRows, setScoreRows] = useState<ScoreRow[]>(computedInitialScoreRows);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // seed initial refs once
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;

    initialNarrativeRef.current = safeString(existingReview?.summary_employee_visible);

    initialScoreMapRef.current = Object.fromEntries(computedInitialScoreRows.map((r) => [r.key, r.score]));
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

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

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

    const nextNarrative = safeString(existingReview?.summary_employee_visible);
    const nextScores = computedInitialScoreRows;

    const nextShare = Boolean(existingReview?.narrative_share_with_employee);
    if (!toggling) setShareWithEmployee(nextShare);

    // guard: if user typed and incoming is empty, don't wipe
    const incomingHasAny = nextNarrative.trim().length > 0;
    if (isDirty && !incomingHasAny) return;

    setNarrative(nextNarrative);
    setScoreRows(nextScores);

    initialNarrativeRef.current = nextNarrative;
    initialScoreMapRef.current = Object.fromEntries(nextScores.map((r) => [r.key, r.score]));

    lastHydrateKeyRef.current = hydrateKey;
    setErrorMsg(null);
  }, [hydrateKey, computedInitialScoreRows, existingReview, isDirty, toggling]);

  const validation = useMemo(() => {
    const missing: string[] = [];
    if (!narrative.trim()) missing.push("Narrative");

    if (canScore) {
      const scoredCats = (rubricCategories ?? []).filter((c) => c.is_scored !== false);
      if (scoredCats.length > 0) {
        for (const r of scoreRows) {
          const v = Number(r.score);
          if (!Number.isFinite(v)) missing.push(`Score: ${r.label}`);
          else if (v < SCORE_MIN || v > SCORE_MAX) missing.push(`Score range: ${r.label} (${SCORE_MIN}-${SCORE_MAX})`);
        }
      }
    }

    return { missing, ok: missing.length === 0 };
  }, [narrative, canScore, rubricCategories, scoreRows]);

  function confirmCommit(): boolean {
    if (!validation.ok) {
      window.alert(
        "Cannot commit yet. Please complete the following:\n\n" + validation.missing.map((m) => `• ${m}`).join("\n")
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
        body: JSON.stringify({ narrative, submit: false }),
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

    const prev = shareWithEmployee;

    setToggling(true);
    setErrorMsg(null);
    setShareWithEmployee(next);

    try {
      const res = await fetch(`/api/reviews/${assignmentId}/share-narrative`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ share: next }),
      });

      const j = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = (typeof j?.error === "string" ? j.error : null) ?? j?.message ?? "Failed to update share setting";
        throw new Error(msg);
      }

      setShareWithEmployee(Boolean(j?.share));
    } catch (err: unknown) {
      setShareWithEmployee(prev);
      const msg = err instanceof Error ? err.message : "Failed to update share setting";
      setErrorMsg(msg);
    } finally {
      setToggling(false);
    }
  }

  const isSubmitted = reviewStatus === "submitted";
  const reviewStatusLabel = isSubmitted ? "Review status: Submitted ✔" : "Review status: Draft";
  const reviewStatusTone = isSubmitted ? "success" : "warning";

  const employeeVisibilityLabel = releasedAt ? "Employee visibility: Released" : "Employee visibility: Not released";
  const employeeVisibilityTone = releasedAt ? "success" : "neutral";

  const missingLabel = validation.ok ? "Ready to commit" : `${validation.missing.length} required item(s)`;

  const scoredCats = useMemo(() => (rubricCategories ?? []).filter((c) => c.is_scored !== false), [rubricCategories]);
  const completedScoresCount = useMemo(() => {
    if (!canScore) return 0;
    return scoreRows.filter((r) => Number.isFinite(Number(r.score))).length;
  }, [scoreRows, canScore]);

  return (
    <div className="space-y-4">
      {/* Sticky header */}
      <div className="sticky top-4 z-10">
        <div className="rounded-2xl border border-orange-100/70 bg-[#fff7f0]/80 p-4 shadow-[0_10px_30px_rgba(249,115,22,0.06)] backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="truncate text-lg font-semibold text-slate-900">Reviewing {employeeName}</div>
                  <Badge label={reviewStatusLabel} tone={reviewStatusTone as any} />
                  <Badge
                    label={employeeVisibilityLabel}
                    tone={employeeVisibilityTone as any}
                    title={releasedAt ? `Released at ${releasedAt}` : "Not released to employee yet"}
                  />
                </div>

                <div className="mt-1 text-sm text-slate-600">
                  <span className="text-slate-500">Cycle:</span> {cycleLabel}
                </div>

                {isDirty && !isLocked ? (
                  <div className="mt-1 text-xs font-semibold text-amber-800">Unsaved changes</div>
                ) : isLocked ? (
                  <div className="mt-1 text-xs font-semibold text-emerald-700">Committed and locked</div>
                ) : (
                  <div className="mt-1 text-xs text-slate-500">You can save anytime before commit.</div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:justify-end">
              <button
                type="button"
                disabled={saving || isLocked || !validation.ok}
                onClick={commitReview}
                className={cn(
                  "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm",
                  saving || isLocked || !validation.ok
                    ? "bg-slate-200 text-slate-600 cursor-not-allowed"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                )}
              >
                Commit →
              </button>
            </div>
          </div>
        </div>
      </div>
  
      {/* Body: main + right rail */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px] lg:items-start">
        {/* Main */}
        <div className="space-y-4">
          {/* Narrative card */}
          <div className="rounded-2xl border border-orange-100/70 bg-[#fff7f0]/55 p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-base font-semibold text-slate-900">Narrative</div>
                <div className="mt-1 text-sm text-slate-600">
                  Save anytime. Commit locks both narrative and scores.
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <button
                  type="button"
                  disabled={saving || isLocked || !isNarrativeDirty}
                  onClick={saveNarrativeOnly}
                  className={cn(
                    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm",
                    saving || isLocked || !isNarrativeDirty
                      ? "bg-slate-200 text-slate-600 cursor-not-allowed"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  )}
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

            <div className="mt-3 space-y-2">
              <textarea
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                rows={14}
                disabled={saving || isLocked}
                className={cn(
                  "w-full rounded-2xl border border-orange-100/70 bg-white/70 p-3 text-sm text-slate-900 shadow-inner outline-none focus:ring-2 focus:ring-orange-200",
                  isLocked ? "opacity-75" : ""
                )}
                placeholder="Write a clear summary that the employee can understand and act on."
              />
              <div className="text-xs text-slate-600">
                Visible to the employee only if Admin enables “Share with employee” and the cycle is released.
              </div>
            </div>
          </div>

          {/* Scores card */}
          {canScore ? (
            <div className="rounded-2xl border border-orange-100/70 bg-[#fff7f0]/55 p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-base font-semibold text-slate-900">Scores</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Required for commit. Range {SCORE_MIN} to {SCORE_MAX}.
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:justify-end">
                  <button
                    type="button"
                    disabled={saving || isLocked || scoreRows.length === 0 || !isScoresDirty}
                    onClick={saveScoresOnly}
                    className={cn(
                      "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm",
                      saving || isLocked || scoreRows.length === 0 || !isScoresDirty
                        ? "bg-slate-200 text-slate-600 cursor-not-allowed"
                        : "bg-slate-900 text-white hover:bg-slate-800"
                    )}
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
              </div>

              <div className="mt-4 space-y-3">
                {scoreRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-orange-200 bg-white/60 p-4 text-sm text-slate-600">
                    No rubric categories available for scoring.
                  </div>
                ) : (
                  scoreRows.map((r, idx) => (
                    <div
                      key={r.key}
                      className="flex flex-col gap-2 rounded-2xl border border-orange-100/70 bg-white/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900">{r.label}</div>
                        <div className="mt-0.5 text-xs text-slate-600">
                          <span className="font-mono">{r.key}</span>
                          {r.weight != null ? <span>{` · weight ${r.weight}`}</span> : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
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
                          className={cn(
                            "h-10 w-28 rounded-xl border border-orange-100/70 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-orange-200",
                            isLocked ? "opacity-75" : ""
                          )}
                        />
                        <div className="text-xs text-slate-600">/ {SCORE_MAX}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {/* Error */}
          {errorMsg ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 whitespace-pre-wrap">
              {errorMsg}
            </div>
          ) : null}
        </div>

        {/* Right rail */}
        <div className="lg:sticky lg:top-24 space-y-4">
          <div className="rounded-2xl border border-orange-100/70 bg-[#fff7f0]/55 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Review Summary</div>
                <div className="mt-1 text-xs text-slate-600">
                  {isLocked ? "Locked after commit." : "Track completion and visibility."}
                </div>
              </div>
              <Badge label={missingLabel} tone={validation.ok ? "success" : "warning"} />
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="text-slate-600">Narrative</div>
                <div className="font-semibold text-slate-900">{narrative.trim() ? "Complete" : "Required"}</div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-slate-600">Scores</div>
                <div className="font-semibold text-slate-900">
                  {canScore ? `${completedScoresCount}/${scoredCats.length}` : "Not required"}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-slate-600">Status</div>
                <div className="font-semibold text-slate-900">{isSubmitted ? "Submitted" : "Draft"}</div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-slate-600">Employee release</div>
                <div className="font-semibold text-slate-900">{releasedAt ? "Released" : "Not released"}</div>
              </div>
            </div>

            {isAdmin ? (
              <div className="mt-4 rounded-2xl border border-orange-100/70 bg-white/60 p-3">
                <Toggle
                  checked={shareWithEmployee}
                  disabled={saving || toggling || !canToggleShare}
                  onChange={(v) => handleToggleShare(v)}
                  label="Share narrative with employee"
                  hint={
                    releasedAt
                      ? "Locked after release."
                      : reviewStatus !== "submitted"
                      ? "Available after submit."
                      : "Controls narrative visibility on release."
                  }
                />
              </div>
            ) : null}

            {!validation.ok && !isLocked ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <div className="font-semibold">To commit, complete:</div>
                <div className="mt-2 space-y-1">
                  {validation.missing.map((m) => (
                    <div key={m}>• {m}</div>
                  ))}
                </div>
              </div>
            ) : null}

        </div>
      </div>
    </div>
  </div>
  );
}
