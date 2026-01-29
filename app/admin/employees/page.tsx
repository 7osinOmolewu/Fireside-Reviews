"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getMyRole } from "@/lib/me";

type JobRole = { id: string; code: string; name: string };

type EmployeeRow = {
  id: string;
  job_role_id: string | null;
  hire_date: string | null;
  employee_code: string | null;
  job_roles: { id: string; code: string; name: string } | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

export function BackToAdmin() {
  return (
    <Link href="/admin" style={{ textDecoration: "underline" }}>
      Admin
    </Link>
  );
}
export default function EmployeesAdminPage() {
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editJobRoleId, setEditJobRoleId] = useState<string>("");
  const [editHireDate, setEditHireDate] = useState<string>("");
  const [editFullName, setEditFullName] = useState<string>("");
  const [editEmployeeEmail, setEditEmail] = useState<string>("");

  const [jobRoleId, setJobRoleId] = useState<string>("");
  const [hireDate, setHireDate] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");

  const roleById = useMemo(() => {
    const m = new Map<string, JobRole>();
    for (const r of jobRoles) m.set(r.id, r);
    return m;
  }, [jobRoles]);

  async function loadAll() {
    const [emps, roles] = await Promise.all([
      supabase
        .from("employees")
        .select(
          `
          id,
          job_role_id,
          hire_date,
          employee_code,
          job_roles:job_role_id ( id, code, name ),
          profiles:profiles!employees_id_fkey ( full_name, email )
        `
        )
        .order("created_at", { ascending: false }),
      supabase.from("job_roles").select("id,code,name").order("name"),
    ]);

    if (emps.error) throw emps.error;
    if (roles.error) throw roles.error;

    setRows((emps.data ?? []) as unknown as EmployeeRow[]);
    setJobRoles((roles.data ?? []) as JobRole[]);
  }

  useEffect(() => {
    (async () => {
      const me = await getMyRole();
      if (!me) return (window.location.href = "/login");
      if (me.role !== "admin") return (window.location.href = "/");
      await loadAll();
    })().catch((e) => setError(e?.message ?? "Unknown error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addEmployee(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const name = fullName.trim();
    const eml = email.trim();
    if (!name) return setError(JSON.stringify({ error: "full_name is required" }, null, 2));
    if (!eml) return setError(JSON.stringify({ error: "email is required" }, null, 2));
    if (!jobRoleId) return setError(JSON.stringify({ error: "job_role_id is required" }, null, 2));

    const res = await fetch("/api/admin/invite-user", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: eml,
        full_name: name,
        job_role_id: jobRoleId,
        hire_date: hireDate || null,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(JSON.stringify(json, null, 2));

    setEmail("");
    setFullName("");
    setHireDate("");
    setJobRoleId("");
    await loadAll();
  }

  function startEdit(r: EmployeeRow) {
    setEditingId(r.id);
    setEditFullName(r.profiles?.full_name ?? "");
    setEditEmail(r.profiles?.email ?? "");
    setEditJobRoleId(r.job_role_id ?? "");
    setEditHireDate(r.hire_date ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditFullName("");
    setEditJobRoleId("");
    setEditHireDate("");
    setEditEmail("");
  }

  async function saveEdit(id: string) {
    setError(null);

    const payload: Record<string, any> = {
      job_role_id: editJobRoleId || null,
      hire_date: editHireDate || null,
    };

    const eml = editEmployeeEmail.trim();
    if (eml) payload.email = eml;

    const name = editFullName.trim();
    if (name) payload.full_name = name;

    const res = await fetch(`/api/admin/employees/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(JSON.stringify(json, null, 2));

    setEditingId(null);
    await loadAll();
  }

  return (
    <main style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
         <h1 style={{ margin: 0 , marginTop: 24 }}><BackToAdmin />· Employees </h1>
        </div>

        {/* #2: Next button to Assignments */}
        <Link
          href="/admin/assignments"
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            textDecoration: "none",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          Next: Assignments →
        </Link>
      </div>

      <section style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 10 }}>
        <h2>Add Employee</h2>

        <form onSubmit={addEmployee} style={{ display: "grid", gap: 10, maxWidth: 520 }}>
          <input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />

          <select value={jobRoleId} onChange={(e) => setJobRoleId(e.target.value)} required>
            <option value="">Select job family</option>
            {jobRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          <input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
          <button type="submit">Add</button>
        </form>

        {error && <pre style={{ marginTop: 12 }}>{error}</pre>}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Employees</h2>

        <table width="100%" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Name</th>
              <th style={{ textAlign: "left" }}>Job Family</th>
              <th style={{ textAlign: "left" }}>Employee Code</th>
              <th style={{ textAlign: "left" }}>Employee Email</th>
              <th style={{ textAlign: "left" }}>Hire Date</th>
              <th />
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => {
              const isEditing = editingId === r.id;
              const displayName = r.profiles?.full_name ?? "(no name)";
              const displayJob = r.job_roles?.name ?? "(none)";

              return (
                <tr key={r.id}>
                  <td>
                    {isEditing ? (
                      <input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} />
                    ) : (
                      displayName
                    )}
                  </td>

                  <td>
                    {isEditing ? (
                      <select value={editJobRoleId} onChange={(e) => setEditJobRoleId(e.target.value)}>
                        <option value="">Select</option>
                        {jobRoles.map((jr) => (
                          <option key={jr.id} value={jr.id}>
                            {jr.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      displayJob
                    )}
                  </td>

                  <td>{r.employee_code ?? "(none)"}</td>

                  <td>
                    {isEditing ? (
                      <input type="email" value={editEmployeeEmail} onChange={(e) => setEditEmail(e.target.value)} />
                    ) : (
                      r.profiles?.email ?? "(none)"
                    )}
                  </td>

                  <td>
                    {isEditing ? (
                      <input type="date" value={editHireDate} onChange={(e) => setEditHireDate(e.target.value)} />
                    ) : (
                      r.hire_date ?? "(none)"
                    )}
                  </td>

                  <td>
                    {isEditing ? (
                      <>
                        <button type="button" onClick={() => saveEdit(r.id)}>
                          Save
                        </button>{" "}
                        <button type="button" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => startEdit(r)}>
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div style={{ marginTop: 6 }}>
            <Link href="/admin" style={{ textDecoration: "underline" }}>
              Back to Admin
            </Link>
      </div>

    </main>
  );
}
