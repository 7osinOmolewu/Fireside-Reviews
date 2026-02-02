"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  reviewId: string;
  reviewStatus: string | null;
};

export function AdminReopenReviewButton({ reviewId, reviewStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const canReopen = reviewStatus === "submitted" || reviewStatus === "finalized";

  async function onClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();

    if (!canReopen || loading) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}/reopen`, {
        method: "POST",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error ?? "Failed to reopen review");
        return;
      }

      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!canReopen || loading}
      style={{
        padding: "8px 12px",
        fontSize: 13,
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        background: canReopen ? "white" : "#f3f4f6",
        cursor: canReopen && !loading ? "pointer" : "not-allowed",
        fontWeight: 750,
        minWidth: 140,
      }}
      title={canReopen ? "Reopen review" : "Only submitted reviews can be reopened"}
    >
      {loading ? "Reopening..." : "Reopen Review"}
    </button>
  );
}
