"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const STORAGE_KEY = "fireside:selectedCycleId";

export function useCycleSelection(fallbackCycleId?: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const cycleIdFromUrl = searchParams.get("cycleId") || "";
  const [cycleId, setCycleIdState] = useState<string>(cycleIdFromUrl);

  // Initialize from URL, else localStorage, else fallback
  useEffect(() => {
    const urlVal = cycleIdFromUrl;
    if (urlVal) {
      setCycleIdState(urlVal);
      try {
        localStorage.setItem(STORAGE_KEY, urlVal);
      } catch {}
      return;
    }

    let stored = "";
    try {
      stored = localStorage.getItem(STORAGE_KEY) || "";
    } catch {}

    const next = stored || fallbackCycleId || "";
    if (!next) return;

    // If URL missing, normalize URL once
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("cycleId", next);
    router.replace(`${pathname}?${sp.toString()}`);
    setCycleIdState(next);
  }, [cycleIdFromUrl, fallbackCycleId, pathname, router, searchParams]);

  const setCycleId = (nextId: string) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("cycleId", nextId);
    router.replace(`${pathname}?${sp.toString()}`);
    setCycleIdState(nextId);
    try {
      localStorage.setItem(STORAGE_KEY, nextId);
    } catch {}
  };

  return useMemo(() => ({ cycleId, setCycleId }), [cycleId]);
}
