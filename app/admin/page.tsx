"use client";

import { useEffect, useState } from "react";
import { getMyRole } from "@/lib/me";
import Link from "next/link";

export default function AdminPage() {
 
  const [state, setState] = useState<string>("Loading...");

  useEffect(() => {
    (async () => {
      const me = await getMyRole();
      if (!me) {
        window.location.href = "/login";
        return;
      }
      if (me.role !== "admin") {
        window.location.href = "/";
        return;
      }
      setState(`Welcome, ${me.fullName}`);
    })();
  }, []);

  return (
    <main
      style={{
        padding: 24,
        fontFamily: "system-ui",
        maxWidth: 720,
      }}
    >
    {/* Top bar */}
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
      }}
    >
    <h1 style={{ margin: 0 }}>Admin</h1>
      <form action="/api/auth/logout" method="post">
        <button
          type="submit"
          style={{
            padding: "6px 10px",
            fontSize: 13,
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
          }}
        >
        Log out
        </button>
      </form>
    </div>
  
  <p>{state}</p>

    <ol style={{ marginTop: 16, lineHeight: 1.8 }}>
      <li>
        <Link href="/admin/cycles">Manage Cycles</Link>
      </li>
      <li>
        <Link href="/admin/job-families">Job Families</Link>
      </li>
      <li>
        <Link href="/admin/employees">Employees</Link>
      </li>
      <li>
        <Link href="/admin/assignments">Assignments</Link>
      </li>
    </ol>
  </main>
  );
}
