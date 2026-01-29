// lib/types/reviews.ts
import type { Database } from "@/supabase/types/database.types";

export type ReviewerType = Database["public"]["Enums"]["reviewer_type"];

export type ReviewAssignmentRow = Database["public"]["Tables"]["review_assignments"]["Row"];
export type EmployeeRow = Database["public"]["Tables"]["employees"]["Row"];
export type ReviewRow = Database["public"]["Tables"]["reviews"]["Row"];
export type ReviewScoreRow = Database["public"]["Tables"]["review_scores"]["Row"];
export type RubricCategoryRow = Database["public"]["Tables"]["rubric_categories"]["Row"];

// This matches your nested select shape (employees can come back as object or array)
export type AssignmentPayload = Pick<
  ReviewAssignmentRow,
  "id" | "reviewer_type" | "cycle_id" | "employee_id"
> & {
  employees: Pick<EmployeeRow, "job_role_id"> | Pick<EmployeeRow, "job_role_id">[] | null;
  reviews:
    | (Pick<
        ReviewRow,
        | "id"
        | "status"
        | "summary_reviewer_private"
        | "summary_employee_visible"
        | "submitted_at"
      > & {
        review_scores:
          | Pick<
              ReviewScoreRow,
              | "review_id"
              | "category_scores"
              | "base_score"
              | "calibration_adjustment"
              | "final_score"
              | "updated_at"
            >[]
          | null;
      })[]
    | null;
};
