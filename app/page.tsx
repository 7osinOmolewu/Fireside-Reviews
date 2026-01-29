"use client";

import { useEffect, useState } from "react";
import { getMyRole } from "@/lib/me";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const [status, setStatus] = useState("Loading...");

  useEffect(() => {
    (async () => {
      const me = await getMyRole();
      if (!me) {
        setStatus("Not signed in");
        return;
      }

      setStatus(`Signed in as: ${me.email ?? ""} (${me.role})`);

      if (me.role === "admin") window.location.href = "/admin";
      else if (me.role === "reviewer") window.location.href = "/reviewer";
      else window.location.href = "/employee";
    })();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Fireside Reviews</h1>
      <p>{status}</p>

      <button onClick={signOut} style={{ marginTop: 12, padding: "8px 12px" }}>
        Sign out
      </button>
    </main>
  );
}