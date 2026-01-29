"use client";

import { useEffect, useState } from "react";
import { getMyRole } from "@/lib/me";

export default function EmployeePage() {
  const [state, setState] = useState<string>("Loading...");

  useEffect(() => {
    (async () => {
      const me = await getMyRole();
      if (!me) {
        window.location.href = "/login";
        return;
      }
      setState(`Employee view: ${me.fullName}`);
    })();
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Employee</h1>
      <p>{state}</p>
      <p>Next: show finalized summary only (public table).</p>
    </main>
  );
}