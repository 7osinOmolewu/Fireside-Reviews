"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  employeeIds: string[];
  currentIndex: number;
};

export function ReviewQueueNav({ employeeIds, currentIndex }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const total = employeeIds.length;
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < total - 1;

  const progressLabel = useMemo(() => {
    if (total === 0) return "0 of 0";
    return `${currentIndex + 1} of ${total}`;
  }, [currentIndex, total]);

  function goToIndex(nextIndex: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("employeeIds", employeeIds.join(","));
    params.set("index", String(nextIndex));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-[#fff7f0] p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-stone-500">Review queue</p>
          <p className="text-lg font-semibold text-stone-900">{progressLabel}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => goToIndex(currentIndex - 1)}
            disabled={!hasPrevious}
            className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous employee
          </button>

          <button
            type="button"
            onClick={() => hasNext && goToIndex(currentIndex + 1)}
            disabled={!hasNext}
            className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Skip
          </button>

          <button
            type="button"
            onClick={() => goToIndex(currentIndex + 1)}
            disabled={!hasNext}
            className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next employee
          </button>
        </div>
      </div>
    </div>
  );
}