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

    const ok = window.confirm("Reopen this submitted review? The reviewer will be able to edit and resubmit.");
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
    <div style={{ display: "grid", gap: 6 }}>
      <span title={title} style={{ display: "inline-block" }}>
        <button
          onClick={onReopen}
          disabled={isDisabled}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "white",
            cursor: isDisabled ? "not-allowed" : "pointer",
            fontWeight: 700,
            opacity: isDisabled ? 0.55 : 1,
            width: "fit-content",
          }}
        >
          {loading ? "Reopening..." : "Reopen"}
        </button>
      </span>

      {err ? <div style={{ fontSize: 12, color: "#b91c1c" }}>{err}</div> : null}
    </div>
  );
}
