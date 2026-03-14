"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return;

    setLoading(true);
    setMessage(null);
    setErrorMsg(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      setMessage(
        "If an account exists for that email, a password reset link has been sent."
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unable to send reset email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fbf4ec] px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl border border-orange-100/70 bg-[#fffdfb]/85 p-8 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Reset password
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Enter your email and we will send a reset link.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-900">Email</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="block w-full rounded-2xl border border-orange-100/70 bg-[#fff7f0]/70 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-200 focus:ring-2 focus:ring-orange-200"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className={cn(
                "inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold shadow-sm transition",
                loading
                  ? "cursor-not-allowed bg-slate-200 text-slate-600"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              )}
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>

          {message ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {message}
            </div>
          ) : null}

          {errorMsg ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              {errorMsg}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}