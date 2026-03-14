import { AppShell } from "../_components/app-shell";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { resolveCycleServer } from "@/lib/activeCycleServer";

type RoleLabel = "Admin" | "Reviewer" | "Employee";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userName: string | null = null;
  let roleLabel: RoleLabel = "Employee";
  let isAdmin = false;
  let pendingReviews: Array<{ id: string; label: string; href: string }> = [];

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    userName = profile?.full_name ?? profile?.email ?? null;

    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    isAdmin = Boolean(adminRow?.id);

    const { count } = await supabase
      .from("review_assignments")
      .select("id", { count: "exact", head: true })
      .eq("reviewer_id", user.id)
      .eq("is_active", true);

    if (isAdmin) {
      roleLabel = "Admin";
    } else {
      roleLabel = (count ?? 0) > 0 ? "Reviewer" : "Employee";
    }

    // Match old reviews page scoping:
    // current reviewer + active assignments + current globally active cycle scope
    const cycle = await resolveCycleServer({
      userId: user.id,
      cycleIdFromQS: null,
    });

    const cycleIdsToUse = cycle.cycleIdsToUse ?? [];

    if (cycleIdsToUse.length > 0) {
      const { data: navAssignments, error: navAssignmentsError } = await supabase
        .from("review_assignments")
        .select(
          `
          id,
          cycle_id,
          employee_id,
          reviewer_type,
          created_at,
          employees (
            id,
            employee_code,
            profiles ( id, full_name )
          )
        `
        )
        .eq("reviewer_id", user.id)
        .eq("is_active", true)
        .in("cycle_id", cycleIdsToUse)
        .order("created_at", { ascending: false });

      if (!navAssignmentsError) {
        const assignmentIds = (navAssignments ?? []).map((a: any) => a.id);

        const { data: navReviews, error: navReviewsError } = assignmentIds.length
          ? await supabase
              .from("reviews")
              .select("assignment_id, status, updated_at, created_at")
              .in("assignment_id", assignmentIds)
          : { data: [], error: null };

        if (!navReviewsError) {
          const latestReviewByAssignmentId = new Map<
            string,
            {
              assignment_id: string;
              status: string | null;
              updated_at?: string | null;
              created_at?: string | null;
            }
          >();

          for (const r of navReviews ?? []) {
            const existing = latestReviewByAssignmentId.get(r.assignment_id);
            const existingTs = existing?.updated_at ?? existing?.created_at ?? "";
            const nextTs = r.updated_at ?? r.created_at ?? "";

            if (!existing || nextTs >= existingTs) {
              latestReviewByAssignmentId.set(r.assignment_id, r);
            }
          }

          pendingReviews = (navAssignments ?? [])
            .filter((a: any) => {
              const review = latestReviewByAssignmentId.get(a.id);
              const status = review?.status ?? null;

              // Pending only = not yet submitted/finalized
              return !(status === "submitted" || status === "finalized");
            })
            .map((a: any) => {
              const label =
                a?.employees?.profiles?.full_name ??
                a?.employees?.employee_code ??
                "Unknown employee";

              return {
                id: a.id,
                label,
                href: `/reviews/${a.id}${cycle.cycleQS ?? ""}`,
              };
            });
        }
      }
    }
  }

  return (
    <AppShell
      isAuthenticated={!!user}
      userName={userName}
      roleLabel={roleLabel}
      isAdmin={isAdmin}
      pendingReviews={pendingReviews}
    >
      {children}
    </AppShell>
  );
}