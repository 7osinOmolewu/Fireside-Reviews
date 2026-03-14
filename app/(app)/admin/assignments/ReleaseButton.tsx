"use client";

import { useMemo, useState } from "react";

type Props = {
  cycleId: string;
  employeeId: string;
  releasedAt: string | null;
  onReleased?: (releasedAt: string) => void;
};

export function ReleaseButton({ cycleId, employeeId, releasedAt, onReleased }: Props) {
  const [loading, setLoading] = useState(false);
  const isReleased = useMemo(() => Boolean(releasedAt), [releasedAt]);

  async function onClick() {
    if (isReleased || loading) return;
    setLoading(true);

    try {
      const res = await fetch("/api/admin/release-employee-cycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId, employeeId }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Release failed");

      const newReleasedAt = json?.summary?.released_at as string | undefined;
      if (newReleasedAt) onReleased?.(newReleasedAt);
    } catch (e: any) {
      alert(e?.message ?? "Release failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isReleased || loading}
      className={`rounded px-3 py-1 text-sm ${
        isReleased
          ? "cursor-not-allowed bg-gray-200 text-gray-600"
          : "bg-black text-white hover:opacity-90"
      }`}
    >
      {isReleased ? "Released" : loading ? "Releasing..." : "Release Review"}
    </button>
  );
}
