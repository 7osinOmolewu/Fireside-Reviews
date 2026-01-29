import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export default async function ReviewsPage() {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) redirect("/login");

    // Adjust select() fields to your schema.
    const { data: assignments, error } = await supabase
    .from("review_assignments")
        .select(`
            id,
            reviewer_type,
            cycle_id,
            employee_id,
            created_at,
            reviews ( id, status, submitted_at )
    `)
    .eq("reviewer_id", auth.user.id)
    .order("created_at", { ascending: false });

    if (error) {
        return <pre style={{ padding: 16 }}>{JSON.stringify(error, null, 2)}</pre>;
    }

    return (
        <div style={{ padding: 24, maxWidth: 900 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>My Reviews</h1>
        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
            {(assignments ?? []).map((a: any) => {
                const status = a?.reviews?.[0]?.status ?? "not_started";
                const submitted = status === "submitted" || status === "finalized";
                return (
                    <Link
                    key={a.id}
                    href={`/reviews/${a.id}`}
                    style={{
                        border: "1px solid #ddd",
                        borderRadius: 12,
                        padding: 16,
                        textDecoration: "none",
                        color: "inherit",
                    }}
                    >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div>
                        <div style={{ fontWeight: 700 }}>Assignment {a.id}</div>
                        <div style={{ opacity: 0.8 }}>Reviewer type: {a.reviewer_type}</div>
                        </div>
                        <div style={{ fontWeight: 700 }}>{submitted ? "Submitted" : "Draft"}</div>
                    </div>
                    </Link>
                );
            })}
        </div>
        </div>
    );
}
