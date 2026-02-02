import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import type { Database } from "@/supabase/types/database.types";

type ReviewAssignmentRow =
  Database["public"]["Tables"]["review_assignments"]["Row"];
type EmployeeRow = Database["public"]["Tables"]["employees"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type JobRoleRow = Database["public"]["Tables"]["job_roles"]["Row"];
type ReviewRow = Database["public"]["Tables"]["reviews"]["Row"];

type AssignmentWithEmployee = ReviewAssignmentRow & {
  employees: (EmployeeRow & {
    profiles: ProfileRow | null;
    job_roles: JobRoleRow | null;
  }) | null;
};

export default async function ReviewsPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const userName = profile?.full_name ?? profile?.email ?? user.email ?? "You";

  // Admin check (admin_users.id = auth.uid())
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = !!adminRow;

  // 1) Fetch open cycles (calibrating)
  const { data: openCycles, error: cyclesError } = await supabase
    .from("review_cycles")
    .select("id, name, status")
    .in("status", ["calibrating"]);

  if (cyclesError) {
    return (
      <pre style={{ padding: 16 }}>{JSON.stringify(cyclesError, null, 2)}</pre>
    );
  }

  const openCycleIds = (openCycles ?? []).map((c) => c.id);

  const cycleById = new Map<string, string>(
    (openCycles ?? []).map((c) => [c.id, c.name])
  );

  // 2) Fetch assignments
  const { data, error } = await supabase
    .from("review_assignments")
    .select(
      `
      id,
      reviewer_type,
      cycle_id,
      employee_id,
      created_at,
      employees (
        id,
        employee_code,
        profiles ( id, full_name ),
        job_roles ( id, name, code )
      )
    `
    )
    .eq("reviewer_id", user.id)
    .eq("is_active", true)
    .in("cycle_id", openCycleIds)
    .order("created_at", { ascending: false });

  if (error) {
    return <pre style={{ padding: 16 }}>{JSON.stringify(error, null, 2)}</pre>;
  }

  const assignments = (data ?? []) as unknown as AssignmentWithEmployee[];

  // 3) Fetch reviews for these assignments so admin can reopen submitted ones
  const assignmentIds = assignments.map((a) => a.id);

  const { data: reviewsData, error: reviewsError } = assignmentIds.length
    ? await supabase
        .from("reviews")
        .select("id, assignment_id, status, submitted_at")
        .in("assignment_id", assignmentIds)
    : { data: [], error: null };

  if (reviewsError) {
    return (
      <pre style={{ padding: 16 }}>{JSON.stringify(reviewsError, null, 2)}</pre>
    );
  }

  const reviewByAssignmentId = new Map<string, Pick<ReviewRow, "id" | "status">>();
  (reviewsData ?? []).forEach((r) => {
    // If multiple exist, last one wins; fine for UI
    reviewByAssignmentId.set(r.assignment_id, { id: r.id, status: r.status });
  });

  return (
    <div
      style={{
        padding: 24,
        maxWidth: 980,
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>
            My Review Inbox
          </h1>

          <div style={{ marginTop: 6, fontSize: 13, color: "#6b7280" }}>
            Signed in as{" "}
            <Link
              href="/employee"
              style={{
                textDecoration: "underline",
                fontWeight: 650,
                color: "inherit",
              }}
            >
              {userName}
            </Link>
            {isAdmin ? (
              <span style={{ marginLeft: 10, fontSize: 12, color: "#111827" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: 999,
                    border: "1px solid #e5e7eb",
                    background: "#f9fafb",
                    fontWeight: 700,
                  }}
                >
                  Admin
                </span>
              </span>
            ) : null}
          </div>

          <div style={{ fontSize: 12, marginTop: 6, color: "#6b7280" }}>
            Assignments returned: {assignments.length}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Link
            href="/employee"
            style={{
              padding: "8px 12px",
              fontSize: 13,
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "white",
              textDecoration: "none",
              color: "inherit",
              fontWeight: 650,
            }}
          >
            View My Results
          </Link>

          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              style={{
                padding: "8px 12px",
                fontSize: 13,
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "white",
                cursor: "pointer",
                fontWeight: 650,
              }}
            >
              Log out
            </button>
          </form>
        </div>
      </div>

      {/* List */}
      <div style={{ display: "grid", gap: 12 }}>
        {assignments.map((a) => {
          const employeeName =
            a.employees?.profiles?.full_name ??
            a.employees?.employee_code ??
            "Unknown employee";

          const jobRole =
            a.employees?.job_roles?.name ??
            a.employees?.job_roles?.code ??
            "Unknown role";

          const cycleName = cycleById.get(a.cycle_id) ?? "Unknown cycle";

          const review = reviewByAssignmentId.get(a.id);
          const reviewStatus = review?.status ?? null;

          const statusLabel =
            reviewStatus === "submitted" || reviewStatus === "finalized"
              ? "Submitted"
              : "Draft";

          return (
            <div
              key={a.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                padding: 16,
                background: "white",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 16 }}>
                      {employeeName}
                    </div>

                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 999,
                        border: "1px solid #e5e7eb",
                        background: "#f9fafb",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#111827",
                      }}
                    >
                      {statusLabel}
                    </span>

                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 999,
                        border: "1px solid #e5e7eb",
                        background: "white",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#111827",
                      }}
                    >
                      {a.reviewer_type}
                    </span>
                  </div>

                  <div style={{ marginTop: 6, color: "#374151", fontSize: 13 }}>
                    Role: {jobRole}
                  </div>
                  <div style={{ marginTop: 2, color: "#374151", fontSize: 13 }}>
                    Cycle: {cycleName}
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <Link
                      href={`/reviews/${a.id}`}
                      style={{
                        display: "inline-block",
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid #e5e7eb",
                        background: "white",
                        textDecoration: "none",
                        color: "inherit",
                        fontSize: 13,
                        fontWeight: 650,
                      }}
                    >
                      Open Review
                    </Link>

                    <span style={{ marginLeft: 10, fontSize: 12, color: "#6b7280" }}>
                      Assignment {a.id}
                    </span>
                  </div>
                </div>

              </div>
            </div>
          );
        })}

        {assignments.length === 0 && (
          <div
            style={{
              border: "1px dashed #d1d5db",
              borderRadius: 14,
              padding: 18,
              background: "#fafafa",
              color: "#6b7280",
            }}
          >
            No review assignments found for your user.
          </div>
        )}
      </div>
    </div>
  );
}
