"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      return;
    }

    setSent(true);
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 520 }}>
      <h1>Fireside Reviews</h1>
      <p>Sign in with your work email. We will email a secure sign-in link.</p>

      {sent ? (
        <p>Check your email for the sign-in link.</p>
      ) : (
        <form onSubmit={handleLogin}>
          <label style={{ display: "block", marginTop: 12 }}>
            Work email
            <input
              suppressHydrationWarning
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }}
              placeholder="you@firesiderx.com"
            />
          </label>

          <button type="submit" style={{ marginTop: 12, padding: "10px 14px" }}>
            Send sign-in link
          </button>

          {error && <p style={{ marginTop: 12 }}>{error}</p>}
        </form>
      )}
    </main>
  );
}
