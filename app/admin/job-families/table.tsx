"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createJobFamily, updateJobFamilyName, deleteJobFamily } from "./actions";

type Row = { code: string; name: string };

export default function JobFamiliesTable({ rows }: { rows: Row[] }) {
  const [pending, startTransition] = useTransition();

  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.code, r.name]))
  );

  const [message, setMessage] = useState<string | null>(null);

  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");

  // Keep drafts in sync when rows change (create/delete)
  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };

      for (const r of rows) {
        if (next[r.code] === undefined) next[r.code] = r.name;
      }

      for (const k of Object.keys(next)) {
        if (!rows.some((r) => r.code === k)) delete next[k];
      }

      return next;
    });
  }, [rows]);

  const isDirty = useMemo(() => {
    return rows.some((r) => (drafts[r.code] ?? "").trim() !== r.name);
  }, [rows, drafts]);

  return (
    <div className="space-y-3">
      {message ? <div className="rounded-md border p-3 text-sm">{message}</div> : null}

      {/* Add new job family */}
      <div className="grid gap-2 md:grid-cols-[220px_1fr_auto]">
        <input
          className="w-full rounded-md border px-3 py-2 font-mono"
          placeholder="CODE (e.g., COMPOUNDING)"
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          disabled={pending}
        />
        <input
          className="w-full rounded-md border px-3 py-2"
          placeholder="Display name (e.g., Compounding)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          disabled={pending}
        />
        <button
          className="rounded-md border px-3 py-2 disabled:opacity-50"
          disabled={pending || !newCode.trim() || !newName.trim()}
          onClick={() => {
            setMessage(null);
            startTransition(async () => {
              const res = await createJobFamily(newCode, newName);
              if (!res.ok) return setMessage(`Error: ${res.error}`);

              setNewCode("");
              setNewName("");
              setMessage("Created.");
              // No router.refresh needed since createJobFamily revalidates the path.
            });
          }}
        >
          Add
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th style={{ textAlign: "left", padding: 3 }} className="px-2 py-3 text-left font-strong">Code</th>
              <th style={{ textAlign: "left", padding: 3 }} className="px-2 py-3 text-left font-strong">Display Name</th>
              <th style={{ textAlign: "left", padding: 3 }} className="px-2 py-3 text-right font-strong">Actions</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => {
              const value = drafts[r.code] ?? "";
              const dirty = value.trim() !== r.name;

              return (
                <tr key={r.code} className="border-t">
                  <td className="px-4 py-3 font-mono">{r.code}</td>

                  <td className="px-4 py-3">
                    <input
                      className="w-full rounded-md border px-3 py-2"
                      value={value}
                      onChange={(e) => setDrafts((d) => ({ ...d, [r.code]: e.target.value }))}
                      disabled={pending}
                    />
                  </td>

                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        className="rounded-md border px-3 py-2 disabled:opacity-50"
                        disabled={pending || !dirty}
                        onClick={() => {
                          setMessage(null);
                          startTransition(async () => {
                            const res = await updateJobFamilyName(r.code, value);
                            setMessage(res.ok ? "Saved." : `Error: ${res.error}`);
                          });
                        }}
                      >
                        Save
                      </button>

                      <button
                        className="rounded-md border px-3 py-2 disabled:opacity-50"
                        disabled={pending}
                        onClick={() => {
                          setDrafts((d) => ({ ...d, [r.code]: r.name }));
                          setMessage(null);
                        }}
                      >
                        Reset
                      </button>

                      <button
                        className="rounded-md border px-3 py-2 disabled:opacity-50"
                        disabled={pending}
                        onClick={() => {
                          const ok = confirm(
                            `Delete job family ${r.code}? This may fail if employees reference it.`
                          );
                          if (!ok) return;

                          setMessage(null);
                          startTransition(async () => {
                            const res = await deleteJobFamily(r.code);
                            setMessage(res.ok ? "Deleted." : `Error: ${res.error}`);
                          });
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!isDirty ? null : <p className="text-xs text-gray-500">You have unsaved changes. Save per row.</p>}
    </div>
  );
}
