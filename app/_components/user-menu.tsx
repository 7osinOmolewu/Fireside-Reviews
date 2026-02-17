"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function UserMenu({
  isAuthenticated,
  userName,
}: {
  isAuthenticated: boolean;
  userName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  if (!isAuthenticated) {
    return (
      <Link
        href="/login"
        className="rounded-lg border border-orange-100 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-orange-50"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg border border-orange-100 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-orange-50"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="max-w-[220px] truncate">{userName ?? "Account"}</span>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" className="text-slate-500">
          <path d="M5.5 7.5l4.5 5 4.5-5H5.5z" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-orange-100 bg-white shadow-lg"
        >
          <Link
            href="/employee"
            className="block px-3 py-2 text-sm text-slate-700 hover:bg-orange-50"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            View My Results
          </Link>

          <div className="h-px bg-orange-100" />

           <div className="p-1">
            <button
              type="button"
              className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-900 hover:bg-orange-50"
              role="menuitem"
              onClick={async () => {
                setOpen(false);

                try {
                  await fetch("/api/auth/logout", { method: "POST" });
                } finally {
                  // hard redirect guarantees fresh auth state
                  window.location.href = "/login";
                }
              }}
            >
              Log out
            </button>
          </div>

        </div>
      ) : null}
    </div>
  );
}
