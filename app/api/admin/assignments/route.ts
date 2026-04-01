import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ReviewerType = "primary" | "self" | "secondary" | "peer";

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

export async function POST(req: Request) {
  try {
    const { supabase, userId } = await requireAdmin();

    const body = await req.json().catch(() => null);

    const cycleId = body?.cycleId;
    const employeeId = body?.employeeId;
    const primaryReviewerId = body?.primaryReviewerId;
    const secondaryReviewerId = body?.secondaryReviewerId ?? null;
    const peerReviewerIds = Array.isArray(body?.peerReviewerIds) ? body.peerReviewerIds : [];

    if (!isUuid(cycleId) || !isUuid(employeeId) || !isUuid(primaryReviewerId)) {
      return NextResponse.json(
        { error: "cycleId, employeeId, and primaryReviewerId are required UUIDs." },
        { status: 400 }
      );
    }

    if (secondaryReviewerId !== null && !isUuid(secondaryReviewerId)) {
      return NextResponse.json({ error: "secondaryReviewerId must be a UUID or null." }, { status: 400 });
    }

    if (!peerReviewerIds.every(isUuid)) {
      return NextResponse.json({ error: "peerReviewerIds must all be UUIDs." }, { status: 400 });
    }

    if (primaryReviewerId === employeeId) {
      return NextResponse.json(
        { error: "Primary reviewer cannot be the employee." },
        { status: 400 }
      );
    }

    if (secondaryReviewerId && secondaryReviewerId === employeeId) {
      return NextResponse.json(
        { error: "Secondary reviewer cannot be the employee." },
        { status: 400 }
      );
    }

    if (peerReviewerIds.includes(employeeId)) {
      return NextResponse.json(
        { error: "Peer reviewers cannot include the employee." },
        { status: 400 }
      );
    }

    const dedupedPeers = uniqueStrings(peerReviewerIds);

    const reviewerIdsToValidate = uniqueStrings([
      primaryReviewerId,
      ...(secondaryReviewerId ? [secondaryReviewerId] : []),
      ...dedupedPeers,
      employeeId,
    ]);

    const { data: employeeAndReviewerRows, error: peopleError } = await supabase
      .from("employees")
      .select("id, job_role_id")
      .in("id", reviewerIdsToValidate);

    if (peopleError) {
      return NextResponse.json({ error: peopleError.message }, { status: 400 });
    }

    const peopleById = new Map<string, { id: string; job_role_id: string | null }>(
      ((employeeAndReviewerRows ?? []) as any[]).map((row) => [row.id, row])
    );

    const employeeRow = peopleById.get(employeeId);

    if (!employeeRow?.job_role_id) {
      return NextResponse.json(
        { error: "Employee job role could not be resolved." },
        { status: 400 }
      );
    }

    for (const peerId of dedupedPeers) {
      const peerRow = peopleById.get(peerId);

      if (!peerRow?.job_role_id) {
        return NextResponse.json(
          { error: "One or more peer reviewers do not have a valid job role." },
          { status: 400 }
        );
      }

      if (peerRow.job_role_id !== employeeRow.job_role_id) {
        return NextResponse.json(
          { error: "Peer reviewers must be in the same job role as the employee." },
          { status: 400 }
        );
      }
    }

    const duplicateReviewerIds = new Set<string>();
    const nonSelfAssignments = [primaryReviewerId, ...(secondaryReviewerId ? [secondaryReviewerId] : []), ...dedupedPeers];

    for (const id of nonSelfAssignments) {
      if (duplicateReviewerIds.has(id)) {
        return NextResponse.json(
          { error: "A reviewer cannot occupy multiple non-self assignment slots for the same employee." },
          { status: 400 }
        );
      }
      duplicateReviewerIds.add(id);
    }

    const desiredAssignments: Array<{
      reviewerId: string;
      reviewerType: ReviewerType;
      isRequired: boolean;
    }> = [
      {
        reviewerId: employeeId,
        reviewerType: "self",
        isRequired: true,
      },
      {
        reviewerId: primaryReviewerId,
        reviewerType: "primary",
        isRequired: true,
      },
      ...dedupedPeers.map((id) => ({
        reviewerId: id,
        reviewerType: "peer" as const,
        isRequired: false,
      })),
    ];

    if (secondaryReviewerId) {
      desiredAssignments.push({
        reviewerId: secondaryReviewerId,
        reviewerType: "secondary",
        isRequired: false,
      });
    }

    const desiredKeys = new Set(
      desiredAssignments.map((a) => `${a.reviewerType}:${a.reviewerId}`)
    );

    const { data: currentRows, error: currentError } = await supabase
      .from("review_assignments")
      .select("id, reviewer_id, reviewer_type, is_active")
      .eq("cycle_id", cycleId)
      .eq("employee_id", employeeId)
      .eq("is_active", true);

    if (currentError) {
      return NextResponse.json({ error: currentError.message }, { status: 400 });
    }

    const toDeactivate = (currentRows ?? []).filter(
      (row: any) => !desiredKeys.has(`${row.reviewer_type}:${row.reviewer_id}`)
    );

    if (toDeactivate.length > 0) {
      const { error: deactivateError } = await supabase
        .from("review_assignments")
        .update({ is_active: false })
        .in(
          "id",
          toDeactivate.map((r: any) => r.id)
        );

      if (deactivateError) {
        return NextResponse.json({ error: deactivateError.message }, { status: 400 });
      }
    }

    const savedAssignments: string[] = [];

    for (const assignment of desiredAssignments) {
      const { data: upserted, error: upsertError } = await supabase
        .from("review_assignments")
        .upsert(
          {
            cycle_id: cycleId,
            employee_id: employeeId,
            reviewer_id: assignment.reviewerId,
            reviewer_type: assignment.reviewerType,
            is_required: assignment.isRequired,
            is_active: true,
            created_by: userId,
          },
          {
            onConflict: "cycle_id,employee_id,reviewer_id,reviewer_type",
          }
        )
        .select("id")
        .single();

      if (upsertError) {
        return NextResponse.json({ error: upsertError.message }, { status: 400 });
      }

      const assignmentId = upserted.id as string;
      savedAssignments.push(assignmentId);

      const { error: reviewError } = await supabase
        .from("reviews")
        .upsert(
          {
            assignment_id: assignmentId,
            cycle_id: cycleId,
            employee_id: employeeId,
            reviewer_id: assignment.reviewerId,
            reviewer_type: assignment.reviewerType,
            status: "draft",
          },
          {
            onConflict: "assignment_id",
          }
        );

      if (reviewError) {
        return NextResponse.json({ error: reviewError.message }, { status: 400 });
      }
    }

    return NextResponse.json({
      ok: true,
      cycleId,
      employeeId,
      savedAssignmentCount: savedAssignments.length,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unauthorized" },
      { status: 403 }
    );
  }
}