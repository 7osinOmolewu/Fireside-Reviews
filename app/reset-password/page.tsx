"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 3l18 18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6 0 10 7 10 7a16.8 16.8 0 0 1-3.4 4.1"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M6.2 6.2C3.7 8 2 12 2 12s4 6 10 6c1.2 0 2.3-.2 3.3-.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setReady(true);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    setErrorMsg(null);

    if (!password || password.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setPassword("");
    setConfirmPassword("");
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#fbf4ec] px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl border border-orange-100/70 bg-[#fffdfb]/85 p-8 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">

          {!success && (
            <>
              <h1 className="text-2xl font-extrabold tracking-tight">
                Choose a new password
              </h1>

              <p className="mt-2 text-sm text-slate-600">
                Enter your new password below.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">

                {/* New password */}
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    New password
                  </span>

                  <div className="relative">
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      className="block w-full rounded-2xl border border-orange-100/70 bg-[#fff7f0]/70 px-4 py-3 pr-10 text-sm outline-none focus:border-orange-200 focus:ring-2 focus:ring-orange-200"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                    >
                      <EyeIcon open={showPassword} />
                    </button>
                  </div>
                </label>

                {/* Confirm password */}
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    Confirm password
                  </span>

                  <div className="relative">
                    <input
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      type={showConfirm ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      className="block w-full rounded-2xl border border-orange-100/70 bg-[#fff7f0]/70 px-4 py-3 pr-10 text-sm outline-none focus:border-orange-200 focus:ring-2 focus:ring-orange-200"
                    />

                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                    >
                      <EyeIcon open={showConfirm} />
                    </button>
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className={cn(
                    "inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold shadow-sm transition",
                    loading
                      ? "bg-slate-200 text-slate-600"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  )}
                >
                  {loading ? "Updating..." : "Update password"}
                </button>
              </form>

              {errorMsg && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                  {errorMsg}
                </div>
              )}
            </>
          )}

          {success && (
            <div className="space-y-4">
              <h1 className="text-2xl font-extrabold">Password updated</h1>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                Your password has been updated successfully.
              </div>

              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Return to login
              </Link>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}