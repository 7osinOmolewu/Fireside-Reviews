"use client";

import Link from "next/link";
import { useState } from "react";
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

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    if (loadingGoogle || loadingPassword) return;

    setLoadingGoogle(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setErrorMsg(error.message);
        setLoadingGoogle(false);
        return;
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unable to start Google sign-in.");
      setLoadingGoogle(false);
    }
  }

  async function handlePasswordSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loadingGoogle || loadingPassword) return;

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) return;

    setLoadingPassword(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        setErrorMsg(
          "Unable to sign in. Check your email/password, reset your password, or use Google if that is how your account was created."
        );
        return;
      }

      window.location.href = "/";
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setLoadingPassword(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fbf4ec] px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl border border-orange-100/70 bg-[#fffdfb]/85 p-8 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Fireside Reviews
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Sign in with Google or with your email and password.
            </p>
          </div>

          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loadingGoogle || loadingPassword}
              className={cn(
                "inline-flex w-full items-center justify-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm transition",
                loadingGoogle || loadingPassword
                  ? "cursor-not-allowed border-slate-200 bg-slate-200 text-slate-600"
                  : "border-orange-100/70 bg-[#fff7f0] text-slate-900 hover:bg-orange-50"
              )}
            >
              {loadingGoogle ? "Redirecting..." : "Continue with Google"}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-orange-100/70" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-[#fffdfb] px-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Or
                </span>
              </div>
            </div>

            <form onSubmit={handlePasswordSignIn} className="space-y-4">
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

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-900">Password</span>

                <div className="relative">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="block w-full rounded-2xl border border-orange-100/70 bg-[#fff7f0]/70 px-4 py-3 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-200 focus:ring-2 focus:ring-orange-200"
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

              <div className="flex items-center justify-between gap-3">
                <Link
                  href="/forgot-password"
                  className="text-sm font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-900"
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loadingGoogle || loadingPassword}
                className={cn(
                  "inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold shadow-sm transition",
                  loadingGoogle || loadingPassword
                    ? "cursor-not-allowed bg-slate-200 text-slate-600"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                )}
              >
                {loadingPassword ? "Signing in..." : "Sign in with password"}
              </button>
            </form>

            {errorMsg ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                {errorMsg}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}