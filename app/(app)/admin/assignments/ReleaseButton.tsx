"use client";

import { useMemo, useState } from "react";

type Props = {
  cycleId: string;
  employeeId: string;
  releasedAt: string | null;
  disabled?: boolean;
  onReleased?: (releasedAt: string) => void;
};

export function ReleaseButton({
  cycleId,
  employeeId,
  releasedAt,
  disabled,
  onReleased,
}: Props) {
  const [loading, setLoading] = useState(false);
  const isReleased = useMemo(() => Boolean(releasedAt), [releasedAt]);
  const isDisabled = Boolean(disabled) || isReleased || loading;

  async function onClick() {
    if (isDisabled) return;
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

  const className = isDisabled
    ? "inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-400 shadow-sm"
    : "inline-flex h-10 items-center justify-center rounded-xl border border-orange-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm hover:bg-orange-50";

  return (
    <button type="button" onClick={onClick} disabled={isDisabled} className={className}>
      {isReleased ? "Released" : loading ? "Releasing..." : "Release"}
    </button>
  );
}