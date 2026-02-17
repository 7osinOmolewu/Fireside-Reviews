"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/app/_components/page-header";
import ReviewForm from "./review-form";
import type { AssignmentPayload, RubricCategoryRow } from "@/lib/types/reviews";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function ReviewAssignmentShell(props: {
  assignmentId: string;
  cycleLabel: string;
  cycleQS: string;

  // nav
  isPending: boolean;
  prevId: string | null;
  nextId: string | null;
  position: number | null;
  total: number;

  // form props
  assignment: AssignmentPayload;
  rubricCategories: RubricCategoryRow[];
  isAdmin: boolean;
  releasedAt: string | null;
}) {
  const router = useRouter();

  const [isDirty, setIsDirty] = useState(false);

  function confirmLeave(): boolean {
    if (!isDirty) return true;
    return window.confirm("You have unsaved changes. Leave this review without saving?");
  }

  function guardedPush(href: string) {
    if (!confirmLeave()) return;
    router.push(href);
  }

  const navControls = useMemo(() => {
    if (!props.isPending) return null;

    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (!props.prevId) return;
            guardedPush(`/reviews/${props.prevId}${props.cycleQS}`);
          }}
          disabled={!props.prevId}
          className={cn(
            "inline-flex items-center justify-center rounded-xl border border-orange-200 bg-[#fff7f0] px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-orange-50",
            !props.prevId && "opacity-50 cursor-not-allowed"
          )}
        >
          Prev
        </button>

        {props.position && props.total ? (
          <div className="px-2 text-sm font-semibold text-slate-600">
            {props.position} of {props.total}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => {
            if (!props.nextId) return;
            guardedPush(`/reviews/${props.nextId}${props.cycleQS}`);
          }}
          disabled={!props.nextId}
          className={cn(
            "inline-flex items-center justify-center rounded-xl border border-orange-200 bg-[#fff7f0] px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-orange-50",
            !props.nextId && "opacity-50 cursor-not-allowed"
          )}
        >
          Next
        </button>
      </div>
    );
  }, [props.isPending, props.prevId, props.nextId, props.position, props.total, props.cycleQS, isDirty]);

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Review" description={`Write and submit a review (${props.cycleLabel})`} />

        <div className="flex items-center gap-3 pt-2">
          {navControls}

          <button
            type="button"
            onClick={() => guardedPush(`/reviews${props.cycleQS}`)}
            className="inline-flex items-center justify-center rounded-xl border border-orange-200 bg-[#fff7f0] px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-orange-50"
          >
            Back to reviews
          </button>
        </div>
      </div>

      <div className="rounded-2xl border bg-gradient-to-b from-[#fbf4ec] to-white p-4 sm:p-6">
        <ReviewForm
          assignment={props.assignment}
          rubricCategories={props.rubricCategories}
          cycleLabel={props.cycleLabel}
          cycleQS={props.cycleQS}
          isAdmin={props.isAdmin}
          releasedAt={props.releasedAt}
          onDirtyChange={setIsDirty}
        />
      </div>
    </>
  );
}
