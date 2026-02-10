import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import type { Database } from "@/supabase/types/database.types";
import { getActiveCycleIdServer } from "@/lib/activeCycleServer"; // ✅ server helper

type ReviewAssignmentRow = Database["public"]["Tables"]["review_assignments"]["Row"];
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

function Badge({
  label,
  tone = "neutral",
  title,
}: {
  label: string;
  tone?: "neutral" | "success" | "warning";
  title?: string;
}) {
  const stylesByTone: Record<string, { bg: string; border: string; text: string }> = {
    neutral: { bg: "#f9fafb", border: "#e5e7eb", text: "#111827" },
    success: { bg: "#ecfdf5", border: "#a7f3d0", text: "#065f46" },
    warning: { bg: "#fffbeb", border: "#fde68a", text: "#92400e" },
  };

  const s = stylesByTone[tone] ?? stylesByTone.neutral;

  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 999,
        border: `1px solid ${s.border}`,
        background: s.bg,
        fontSize: 12,
        fontWeight: 750,
        color: s.text,
        whiteSpace: "nowrap",
        lineHeight: 1.2,
      }}
    >
      {label}
    </span>
  );
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ cycleId?: string }>;
}) {
  const { cycleId } = await searchParams;

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

  const { data: adminRow } = await supabase.from("admin_users").select("id").eq("id", user.id).maybeSingle();
  const isAdmin = !!adminRow;

  // 1) Open cycles (calibrating)
  const { data: openCycles, error: cyclesError } = await supabase
    .from("review_cycles")
    .select("id, name, status")
    .in("status", ["calibrating"]);

  if (cyclesError) return <pre style={{ padding: 16 }}>{JSON.stringify(cyclesError, null, 2)}</pre>;

  const openCycleIds = (openCycles ?? []).map((c) => c.id);
  const cycleById = new Map<string, string>((openCycles ?? []).map((c) => [c.id, c.name]));

// 0) read global active cycle id (server)
const globalActiveCycleId = await getActiveCycleIdServer(); // NOTE: server version, not client

// 1) optional per-page override (QS), admin only, only if valid + open
const overrideCycleId =
  isAdmin && cycleId && openCycleIds.includes(cycleId) ? cycleId : null;

// 2) global default, only if valid + open
const globalCycleId =
  globalActiveCycleId && openCycleIds.includes(globalActiveCycleId) ? globalActiveCycleId : null;

// 3) final decision (override wins). If neither, fall back to first open cycle (or null)
const selectedCycleId = overrideCycleId ?? globalCycleId ?? (openCycleIds[0] ?? null);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const rawCycleIdsToUse = selectedCycleId ? [selectedCycleId] : openCycleIds;

// ✅ sanitize: drop null/undefined/"undefined"/non-uuid
const cycleIdsToUse = rawCycleIdsToUse.filter(
  (x): x is string => typeof x === "string" && x !== "undefined" && UUID_RE.test(x)
);

if (cycleIdsToUse.length === 0) {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ margin: 0 }}>My Review Inbox</h1>
      <p style={{ marginTop: 10, color: "#6b7280" }}>
        No active cycle is available (no open “calibrating” cycles found).
      </p>
    </div>
  );
}

// And this for links
const cycleQS = selectedCycleId ? `?cycleId=${encodeURIComponent(selectedCycleId)}` : "";

// Label from the FINAL selection
const cycleLabel =
  selectedCycleId
    ? cycleById.get(selectedCycleId) ?? "Selected cycle"
    : openCycleIds.length > 1
    ? "All open cycles"
    : openCycleIds.length === 1
    ? cycleById.get(openCycleIds[0]) ?? "Open cycle"
    : "No open cycles";


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
    .in("cycle_id", cycleIdsToUse)
    .order("created_at", { ascending: false });

  if (error) return <pre style={{ padding: 16 }}>{JSON.stringify(error, null, 2)}</pre>;

  const assignments = (data ?? []) as unknown as AssignmentWithEmployee[];

  // 3) Fetch reviews
  const assignmentIds = assignments.map((a) => a.id);

  const { data: reviewsData, error: reviewsError } = assignmentIds.length
    ? await supabase.from("reviews").select("id, assignment_id, status, submitted_at").in("assignment_id", assignmentIds)
    : { data: [], error: null };

  if (reviewsError) return <pre style={{ padding: 16 }}>{JSON.stringify(reviewsError, null, 2)}</pre>;

  const reviewByAssignmentId = new Map<string, Pick<ReviewRow, "id" | "status">>();
  (reviewsData ?? []).forEach((r) => reviewByAssignmentId.set(r.assignment_id, { id: r.id, status: r.status }));

  // 4) Release state
  const employeeIds = Array.from(new Set(assignments.map((a) => a.employee_id).filter(Boolean)));

  const { data: releaseData, error: releaseError } = employeeIds.length
    ? await supabase
        .from("cycle_employee_summary_public")
        .select("cycle_id, employee_id, released_at")
        .in("cycle_id", cycleIdsToUse)
        .in("employee_id", employeeIds)
    : { data: [], error: null };

  if (releaseError) return <pre style={{ padding: 16 }}>{JSON.stringify(releaseError, null, 2)}</pre>;

  const releasedByCycleEmployee = new Map<string, string | null>();
  (releaseData ?? []).forEach((r: any) => releasedByCycleEmployee.set(`${r.cycle_id}:${r.employee_id}`, r.released_at ?? null));

  return (
    <div style={{ padding: 24, maxWidth: 1020, margin: "0 auto", background: "#fafafa", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, letterSpacing: -0.2 }}>My Review Inbox</h1>
            <span style={{ fontSize: 22, color: "#6b7280", fontWeight: 850 }}>({cycleLabel})</span>
          </div>

          <div style={{ marginTop: 8, fontSize: 13, color: "#6b7280" }}>
            Signed in as{" "}
            <Link href={`/employee${cycleQS}`} style={{ textDecoration: "underline", fontWeight: 750, color: "inherit" }}>
              {userName}
            </Link>
            {isAdmin ? (
              <span style={{ marginLeft: 10 }}>
                <Badge label="Admin" tone="neutral" />
              </span>
            ) : null}
          </div>

          {/* ✅ only show clear link when user is actually overriding via QS */}
          {overrideCycleId ? (
            <div style={{ marginTop: 8 }}>
              <Link href="/reviews" style={{ fontSize: 12, color: "#6b7280", textDecoration: "underline", fontWeight: 700 }}>
                Clear cycle filter
              </Link>
            </div>
          ) : null}

          <div style={{ fontSize: 12, marginTop: 6, color: "#6b7280" }}>Assignments: {assignments.length}</div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Link
            href={`/employee${cycleQS}`}
            style={{
              padding: "10px 12px",
              fontSize: 13,
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "white",
              textDecoration: "none",
              color: "#111827",
              fontWeight: 750,
            }}
          >
            View My Results
          </Link>

          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              style={{
                padding: "10px 12px",
                fontSize: 13,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "white",
                cursor: "pointer",
                fontWeight: 750,
                color: "#111827",
              }}
            >
              Log out
            </button>
          </form>
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          background: "white",
          borderRadius: 14,
          padding: 12,
          marginBottom: 12,
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, color: "#111827" }}>Legend:</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Badge label="Review status: Draft" tone="warning" />
          <Badge label="Review status: Submitted ✔" tone="success" />
          <Badge label="Employee visibility: Not released" tone="neutral" />
          <Badge label="Employee visibility: Released" tone="success" />
        </div>
      </div>

      {/* List */}
      <div style={{ display: "grid", gap: 12 }}>
        {assignments.map((a) => {
          const employeeName = a.employees?.profiles?.full_name ?? a.employees?.employee_code ?? "Unknown employee";
          const jobRole = a.employees?.job_roles?.name ?? a.employees?.job_roles?.code ?? "Unknown role";

          const review = reviewByAssignmentId.get(a.id);
          const reviewStatus = review?.status ?? null;

          const isSubmitted = reviewStatus === "submitted" || reviewStatus === "finalized";
          const reviewStatusLabel = isSubmitted ? "Review status: Submitted ✔" : "Review status: Draft";
          const reviewStatusTone = isSubmitted ? "success" : "warning";

          const releasedAt = releasedByCycleEmployee.get(`${a.cycle_id}:${a.employee_id}`) ?? null;
          const isReleased = Boolean(releasedAt);
          const releaseLabel = isReleased ? "Employee visibility: Released" : "Employee visibility: Not released";
          const releaseTone = isReleased ? "success" : "neutral";

          const reviewerTypeLabel =
            a.reviewer_type === "primary"
              ? "Primary reviewer"
              : a.reviewer_type === "secondary"
              ? "Secondary reviewer"
              : a.reviewer_type === "peer"
              ? "Peer reviewer"
              : "Self review";

          return (
            <div
              key={a.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 16,
                background: "white",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 18,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 520,
                        color: "#111827",
                      }}
                    >
                      {employeeName}
                    </div>
                    <Badge label={reviewerTypeLabel} tone="neutral" />
                  </div>

                  <div style={{ marginTop: 8, fontSize: 13, color: "#374151" }}>
                    <span style={{ color: "#6b7280" }}>Role:</span> {jobRole}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <Badge label={reviewStatusLabel} tone={reviewStatusTone as any} />
                    <Badge
                      label={releaseLabel}
                      tone={releaseTone as any}
                      title={releasedAt ? `Released at ${releasedAt}` : "Not released to employee yet"}
                    />
                  </div>

                  <Link
                    href={`/reviews/${a.id}${cycleQS}`}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "1px solid #e5e7eb",
                      background: "#111827",
                      color: "white",
                      textDecoration: "none",
                      fontSize: 13,
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Open review
                  </Link>
                </div>
              </div>
            </div>
          );
        })}

        {assignments.length === 0 && (
          <div style={{ border: "1px dashed #d1d5db", borderRadius: 16, padding: 18, background: "white", color: "#6b7280" }}>
            No review assignments found for your user.
          </div>
        )}
      </div>
    </div>
  );
}
