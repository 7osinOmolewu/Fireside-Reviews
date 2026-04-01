"use client";

import { useState } from "react";

export function AdminReopenReviewButton({
  reviewId,
  disabled,
  title,
}: {
  reviewId: string;
  disabled?: boolean;
  title?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onReopen() {
    if (disabled) return;

    const ok = window.confirm(
      "Reopen this submitted review? The reviewer will be able to edit and resubmit."
    );
    if (!ok) return;

    setErr(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/reopen-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to reopen review");

      window.location.reload();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to reopen review");
    } finally {
      setLoading(false);
    }
  }

  const isDisabled = Boolean(disabled) || loading;

  return (
    <div className="flex flex-col gap-1.5">
      <span title={title} className="inline-block">
        <button
          type="button"
          onClick={onReopen}
          disabled={isDisabled}
          className={
            isDisabled
              ? "inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-400 shadow-sm"
              : "inline-flex h-10 items-center justify-center rounded-xl border border-orange-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm hover:bg-orange-50"
          }
        >
          {loading ? "Reopening..." : "Reopen"}
        </button>
      </span>

      {err ? <div className="text-xs text-red-600">{err}</div> : null}
    </div>
  );
}