"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getMyRole } from "@/lib/me";
import { PageHeader } from "@/app/_components/page-header";

type JobRole = { id: string; code: string; name: string };

type EmployeeRow = {
  id: string;
  job_role_id: string | null;
  hire_date: string | null;
  employee_code: string | null;
  job_roles: { id: string; code: string; name: string } | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return value;
}

export default function EmployeesAdminPage() {
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [editJobRoleId, setEditJobRoleId] = useState<string>("");
  const [editHireDate, setEditHireDate] = useState<string>("");
  const [editFullName, setEditFullName] = useState<string>("");
  const [editEmployeeEmail, setEditEmail] = useState<string>("");

  const [jobRoleId, setJobRoleId] = useState<string>("");
  const [hireDate, setHireDate] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");

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
      supabase.from("job_roles").select("id, code, name").order("name"),
    ]);

    if (emps.error) throw emps.error;
    if (roles.error) throw roles.error;

    setRows((emps.data ?? []) as unknown as EmployeeRow[]);
    setJobRoles((roles.data ?? []) as JobRole[]);
  }

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

      await loadAll();
    })()
      .catch((e) => setError(e?.message ?? "Unknown error"))
      .finally(() => setLoading(false));
  }, []);

  async function addEmployee(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const name = fullName.trim();
    const eml = email.trim().toLowerCase();

    if (!name) return setError("Name is required.");
    if (!eml) return setError("Email is required.");
    if (!jobRoleId) return setError("Job family is required.");

    setAdding(true);

    try {
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
      if (!res.ok) {
        setError(json?.error ?? "Unable to add employee.");
        return;
      }

      setEmail("");
      setFullName("");
      setHireDate("");
      setJobRoleId("");
      setSuccessMsg(`Employee invited successfully: ${eml}`);
      await loadAll();
    } finally {
      setAdding(false);
    }
  }

  function startEdit(r: EmployeeRow) {
    setError(null);
    setSuccessMsg(null);
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
    setSuccessMsg(null);
    setSavingId(id);

    try {
      const payload: Record<string, any> = {
        job_role_id: editJobRoleId || null,
        hire_date: editHireDate || null,
      };

      const eml = editEmployeeEmail.trim().toLowerCase();
      if (eml) payload.email = eml;

      const name = editFullName.trim();
      if (name) payload.full_name = name;

      const res = await fetch(`/api/admin/employees/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ?? "Unable to save employee changes.");
        return;
      }

      setEditingId(null);
      setSuccessMsg("Employee updated successfully.");
      await loadAll();
    } finally {
      setSavingId(null);
    }
  }

  async function deleteEmployee(id: string, name: string) {
    const confirmed = window.confirm(
      `Delete ${name}?\n\nThis should only be used if you intend to permanently remove this employee.`
    );
    if (!confirmed) return;

    setError(null);
    setSuccessMsg(null);
    setDeletingId(id);

    try {
      const res = await fetch(`/api/admin/employees/${id}`, {
        method: "DELETE",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          json?.error ??
            "Delete is not available yet. Backend hard-delete behavior still needs to be confirmed."
        );
        return;
      }

      setSuccessMsg("Employee deleted successfully.");
      await loadAll();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description="Invite employees, manage their profile details, and prepare them for assignment setup."
        right={
          <Link
            href="/admin/assignments"
            className="inline-flex items-center justify-center rounded-xl border border-orange-200 bg-[#fff7f0] px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-orange-50"
          >
            Next: Review Operations →
          </Link>
        }
      />

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      {successMsg ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {successMsg}
        </div>
      ) : null}

      <section className="rounded-2xl border border-orange-100/70 bg-[#fff7f0]/60 p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Add Employee</h2>
          <p className="mt-1 text-sm text-slate-600">
            Invite a new employee and create the core employee record in one step.
          </p>
        </div>

        <form onSubmit={addEmployee} className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-900">Name</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Enter employee name"
              className="block w-full rounded-2xl border border-orange-100/70 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-200 focus:ring-2 focus:ring-orange-200"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-900">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              placeholder="employee@email.com"
              className="block w-full rounded-2xl border border-orange-100/70 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-200 focus:ring-2 focus:ring-orange-200"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-900">Job Family</span>
            <select
              value={jobRoleId}
              onChange={(e) => setJobRoleId(e.target.value)}
              required
              className="block w-full rounded-2xl border border-orange-100/70 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-200 focus:ring-2 focus:ring-orange-200"
            >
              <option value="">Select job family</option>
              {jobRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-900">Hire Date</span>
            <input
              type="date"
              value={hireDate}
              onChange={(e) => setHireDate(e.target.value)}
              className="block w-full rounded-2xl border border-orange-100/70 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-200 focus:ring-2 focus:ring-orange-200"
            />
          </label>

          <div className="lg:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={adding}
              className={cn(
                "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition",
                adding
                  ? "cursor-not-allowed bg-slate-200 text-slate-600"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              )}
            >
              {adding ? "Adding..." : "Add Employee"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-orange-100/70 bg-[#fffdfb]/70 p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Employees</h2>
            <p className="mt-1 text-sm text-slate-600">
              Manage employee profile details before reviewer assignments are configured.
            </p>
          </div>
          <div className="rounded-full border border-orange-100/70 bg-[#fff7f0] px-3 py-1 text-xs font-semibold text-slate-700">
            {rows.length} employee{rows.length === 1 ? "" : "s"}
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-orange-100/70 bg-[#fff7f0]/60 p-4 text-sm text-slate-600">
            Loading employees...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-orange-200 bg-[#fff7f0]/40 p-6 text-sm text-slate-600">
            No employees found.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => {
              const isEditing = editingId === r.id;
              const displayName = r.profiles?.full_name ?? "No name";
              const displayJob = r.job_roles?.name ?? "—";
              const displayEmail = r.profiles?.email ?? "—";

              return (
                <div
                  key={r.id}
                  className="rounded-2xl border border-orange-100/70 bg-[#fff7f0]/45 p-4 shadow-sm"
                >
                  {!isEditing ? (
                    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_0.8fr_1.2fr_0.8fr_auto] lg:items-center">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Name
                        </div>
                        <div className="mt-1 text-base font-semibold text-slate-900">
                          {displayName}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Job Family
                        </div>
                        <div className="mt-1 text-sm text-slate-900">{displayJob}</div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Employee Code
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">
                          {r.employee_code ?? "—"}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Email
                        </div>
                        <div className="mt-1 text-sm text-slate-900">{displayEmail}</div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Hire Date
                        </div>
                        <div className="mt-1 text-sm text-slate-900">{formatDate(r.hire_date)}</div>
                      </div>

                      <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                        <button
                          type="button"
                          onClick={() => startEdit(r)}
                          className="inline-flex items-center justify-center rounded-xl border border-orange-200 bg-[#fff7f0] px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-orange-50"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteEmployee(r.id, displayName)}
                          disabled={deletingId === r.id}
                          className={cn(
                            "inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm transition",
                            deletingId === r.id
                              ? "cursor-not-allowed border-slate-200 bg-slate-200 text-slate-600"
                              : "border-red-200 bg-white text-red-700 hover:bg-red-50"
                          )}
                        >
                          {deletingId === r.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <label className="block">
                          <span className="mb-2 block text-sm font-semibold text-slate-900">
                            Name
                          </span>
                          <input
                            value={editFullName}
                            onChange={(e) => setEditFullName(e.target.value)}
                            className="block w-full rounded-2xl border border-orange-100/70 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-200 focus:ring-2 focus:ring-orange-200"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-sm font-semibold text-slate-900">
                            Email
                          </span>
                          <input
                            type="email"
                            value={editEmployeeEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="block w-full rounded-2xl border border-orange-100/70 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-200 focus:ring-2 focus:ring-orange-200"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-sm font-semibold text-slate-900">
                            Job Family
                          </span>
                          <select
                            value={editJobRoleId}
                            onChange={(e) => setEditJobRoleId(e.target.value)}
                            className="block w-full rounded-2xl border border-orange-100/70 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-200 focus:ring-2 focus:ring-orange-200"
                          >
                            <option value="">Select job family</option>
                            {jobRoles.map((jr) => (
                              <option key={jr.id} value={jr.id}>
                                {jr.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-sm font-semibold text-slate-900">
                            Hire Date
                          </span>
                          <input
                            type="date"
                            value={editHireDate}
                            onChange={(e) => setEditHireDate(e.target.value)}
                            className="block w-full rounded-2xl border border-orange-100/70 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-200 focus:ring-2 focus:ring-orange-200"
                          />
                        </label>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="inline-flex items-center justify-center rounded-xl border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-orange-50"
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          onClick={() => saveEdit(r.id)}
                          disabled={savingId === r.id}
                          className={cn(
                            "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition",
                            savingId === r.id
                              ? "cursor-not-allowed bg-slate-200 text-slate-600"
                              : "bg-slate-900 text-white hover:bg-slate-800"
                          )}
                        >
                          {savingId === r.id ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}