export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          id: string
        }
        Insert: {
          id: string
        }
        Update: {
          id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string
          after_state: Json | null
          before_state: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_user_id: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_employee_outcomes: {
        Row: {
          calibration_adjustment: number
          computed_weighted_score: number | null
          created_at: string
          cycle_id: string
          employee_id: string
          final_rating: string | null
          final_score: number | null
          id: string
          released_at: string | null
          summary_admin_private: string | null
          summary_employee_visible_final: string | null
          updated_at: string
        }
        Insert: {
          calibration_adjustment?: number
          computed_weighted_score?: number | null
          created_at?: string
          cycle_id: string
          employee_id: string
          final_rating?: string | null
          final_score?: number | null
          id?: string
          released_at?: string | null
          summary_admin_private?: string | null
          summary_employee_visible_final?: string | null
          updated_at?: string
        }
        Update: {
          calibration_adjustment?: number
          computed_weighted_score?: number | null
          created_at?: string
          cycle_id?: string
          employee_id?: string
          final_rating?: string | null
          final_score?: number | null
          id?: string
          released_at?: string | null
          summary_admin_private?: string | null
          summary_employee_visible_final?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_employee_outcomes_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "review_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_employee_outcomes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_employee_summary: {
        Row: {
          admin_calibration_notes: string | null
          calibration_reason: string | null
          computed_at: string
          computed_by: string
          created_at: string
          cycle_id: string
          employee_id: string
          final_narrative_employee_visible: string | null
          finalized_at: string | null
          id: string
          performance_rating:
            | Database["public"]["Enums"]["performance_rating"]
            | null
          performance_rating_value: number | null
          primary_final_score: number | null
          primary_review_id: string
          updated_at: string
        }
        Insert: {
          admin_calibration_notes?: string | null
          calibration_reason?: string | null
          computed_at?: string
          computed_by: string
          created_at?: string
          cycle_id: string
          employee_id: string
          final_narrative_employee_visible?: string | null
          finalized_at?: string | null
          id?: string
          performance_rating?:
            | Database["public"]["Enums"]["performance_rating"]
            | null
          performance_rating_value?: number | null
          primary_final_score?: number | null
          primary_review_id: string
          updated_at?: string
        }
        Update: {
          admin_calibration_notes?: string | null
          calibration_reason?: string | null
          computed_at?: string
          computed_by?: string
          created_at?: string
          cycle_id?: string
          employee_id?: string
          final_narrative_employee_visible?: string | null
          finalized_at?: string | null
          id?: string
          performance_rating?:
            | Database["public"]["Enums"]["performance_rating"]
            | null
          performance_rating_value?: number | null
          primary_final_score?: number | null
          primary_review_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_employee_summary_computed_by_fkey"
            columns: ["computed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_employee_summary_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "review_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_employee_summary_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_employee_summary_primary_review_id_fkey"
            columns: ["primary_review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_employee_summary_primary_review_id_fkey"
            columns: ["primary_review_id"]
            isOneToOne: false
            referencedRelation: "reviews_employee_view"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_employee_summary_public: {
        Row: {
          created_at: string
          cycle_id: string
          employee_id: string
          final_narrative_employee_visible: string
          final_score: number | null
          finalized_at: string
          id: string
          performance_rating: Database["public"]["Enums"]["performance_rating"]
          performance_rating_value: number | null
          released_at: string | null
          released_by: string | null
          summary_employee_visible: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle_id: string
          employee_id: string
          final_narrative_employee_visible: string
          final_score?: number | null
          finalized_at: string
          id?: string
          performance_rating: Database["public"]["Enums"]["performance_rating"]
          performance_rating_value?: number | null
          released_at?: string | null
          released_by?: string | null
          summary_employee_visible?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle_id?: string
          employee_id?: string
          final_narrative_employee_visible?: string
          final_score?: number | null
          finalized_at?: string
          id?: string
          performance_rating?: Database["public"]["Enums"]["performance_rating"]
          performance_rating_value?: number | null
          released_at?: string | null
          released_by?: string | null
          summary_employee_visible?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_employee_summary_public_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "review_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_employee_summary_public_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_reviewer_rules: {
        Row: {
          created_at: string
          cycle_id: string
          id: string
          is_scored: boolean
          reviewer_type: Database["public"]["Enums"]["reviewer_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle_id: string
          id?: string
          is_scored?: boolean
          reviewer_type: Database["public"]["Enums"]["reviewer_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle_id?: string
          id?: string
          is_scored?: boolean
          reviewer_type?: Database["public"]["Enums"]["reviewer_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_reviewer_rules_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "review_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_rubrics: {
        Row: {
          created_at: string
          cycle_id: string
          id: string
          job_role_id: string
          rubric_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle_id: string
          id?: string
          job_role_id: string
          rubric_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle_id?: string
          id?: string
          job_role_id?: string
          rubric_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_rubrics_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "review_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_rubrics_job_role_id_fkey"
            columns: ["job_role_id"]
            isOneToOne: false
            referencedRelation: "job_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_rubrics_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "rubrics"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_code_counters: {
        Row: {
          job_role_id: string
          next_num: number
        }
        Insert: {
          job_role_id: string
          next_num?: number
        }
        Update: {
          job_role_id?: string
          next_num?: number
        }
        Relationships: []
      }
      employees: {
        Row: {
          created_at: string
          employee_code: string | null
          hire_date: string | null
          id: string
          job_role_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_code?: string | null
          hire_date?: string | null
          id: string
          job_role_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_code?: string | null
          hire_date?: string | null
          id?: string
          job_role_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_job_role_id_fkey"
            columns: ["job_role_id"]
            isOneToOne: false
            referencedRelation: "job_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_roles: {
        Row: {
          code: string
          employee_code_prefix: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          employee_code_prefix?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          employee_code_prefix?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          can_review: boolean
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          updated_at: string
          user_role: Database["public"]["Enums"]["app_user_role"]
        }
        Insert: {
          can_review?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          updated_at?: string
          user_role?: Database["public"]["Enums"]["app_user_role"]
        }
        Update: {
          can_review?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          user_role?: Database["public"]["Enums"]["app_user_role"]
        }
        Relationships: []
      }
      review_assignments: {
        Row: {
          created_at: string
          created_by: string
          cycle_id: string
          employee_id: string
          id: string
          is_active: boolean
          is_required: boolean
          reviewer_id: string
          reviewer_type: Database["public"]["Enums"]["reviewer_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          cycle_id: string
          employee_id: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          reviewer_id: string
          reviewer_type: Database["public"]["Enums"]["reviewer_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          cycle_id?: string
          employee_id?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          reviewer_id?: string
          reviewer_type?: Database["public"]["Enums"]["reviewer_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_assignments_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "review_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_assignments_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_cycles: {
        Row: {
          created_at: string
          created_by: string
          end_date: string
          id: string
          name: string
          start_date: string
          status: Database["public"]["Enums"]["review_cycle_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          end_date: string
          id?: string
          name: string
          start_date: string
          status?: Database["public"]["Enums"]["review_cycle_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          status?: Database["public"]["Enums"]["review_cycle_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_cycles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_scores: {
        Row: {
          base_score: number | null
          calibration_adjustment: number | null
          category_scores: Json
          created_at: string
          final_score: number | null
          review_id: string
          updated_at: string
        }
        Insert: {
          base_score?: number | null
          calibration_adjustment?: number | null
          category_scores?: Json
          created_at?: string
          final_score?: number | null
          review_id: string
          updated_at?: string
        }
        Update: {
          base_score?: number | null
          calibration_adjustment?: number | null
          category_scores?: Json
          created_at?: string
          final_score?: number | null
          review_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_scores_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_scores_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "reviews_employee_view"
            referencedColumns: ["id"]
          },
        ]
      }
      reviewer_rules: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          is_scored: boolean
          reviewer_type: Database["public"]["Enums"]["reviewer_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          is_scored?: boolean
          reviewer_type: Database["public"]["Enums"]["reviewer_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          is_scored?: boolean
          reviewer_type?: Database["public"]["Enums"]["reviewer_type"]
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          assignment_id: string
          created_at: string
          cycle_id: string
          employee_id: string
          finalized_at: string | null
          id: string
          reviewer_id: string
          reviewer_type: Database["public"]["Enums"]["reviewer_type"]
          status: Database["public"]["Enums"]["review_status"]
          submitted_at: string | null
          summary_employee_visible: string | null
          summary_reviewer_private: string | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          cycle_id: string
          employee_id: string
          finalized_at?: string | null
          id?: string
          reviewer_id: string
          reviewer_type: Database["public"]["Enums"]["reviewer_type"]
          status?: Database["public"]["Enums"]["review_status"]
          submitted_at?: string | null
          summary_employee_visible?: string | null
          summary_reviewer_private?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          cycle_id?: string
          employee_id?: string
          finalized_at?: string | null
          id?: string
          reviewer_id?: string
          reviewer_type?: Database["public"]["Enums"]["reviewer_type"]
          status?: Database["public"]["Enums"]["review_status"]
          submitted_at?: string | null
          summary_employee_visible?: string | null
          summary_reviewer_private?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "review_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "review_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rubric_categories: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_scored: boolean
          name: string
          rubric_id: string
          sort_order: number
          updated_at: string
          weight: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_scored?: boolean
          name: string
          rubric_id: string
          sort_order?: number
          updated_at?: string
          weight: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_scored?: boolean
          name?: string
          rubric_id?: string
          sort_order?: number
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "rubric_categories_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "rubrics"
            referencedColumns: ["id"]
          },
        ]
      }
      rubric_questions: {
        Row: {
          category_id: string
          created_at: string
          guidance: string | null
          id: string
          prompt: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          guidance?: string | null
          id?: string
          prompt: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          guidance?: string | null
          id?: string
          prompt?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rubric_questions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "rubric_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      rubrics: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          role_id: string
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          id: string
          is_active?: boolean
          role_id: string
          updated_at?: string
          version: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          role_id?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "rubrics_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "job_roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      employee_cycle_results_view: {
        Row: {
          cycle_id: string | null
          employee_id: string | null
          final_score: number | null
          performance_rating:
            | Database["public"]["Enums"]["performance_rating"]
            | null
          performance_rating_value: number | null
          released_at: string | null
          summary_employee_visible: string | null
          updated_at: string | null
        }
        Insert: {
          cycle_id?: string | null
          employee_id?: string | null
          final_score?: number | null
          performance_rating?:
            | Database["public"]["Enums"]["performance_rating"]
            | null
          performance_rating_value?: number | null
          released_at?: string | null
          summary_employee_visible?: string | null
          updated_at?: string | null
        }
        Update: {
          cycle_id?: string | null
          employee_id?: string | null
          final_score?: number | null
          performance_rating?:
            | Database["public"]["Enums"]["performance_rating"]
            | null
          performance_rating_value?: number | null
          released_at?: string | null
          summary_employee_visible?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cycle_employee_summary_public_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "review_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_employee_summary_public_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      review_scores_employee_view: {
        Row: {
          base_score: number | null
          calibration_adjustment: number | null
          created_at: string | null
          final_score: number | null
          review_id: string | null
          updated_at: string | null
        }
        Insert: {
          base_score?: number | null
          calibration_adjustment?: number | null
          created_at?: string | null
          final_score?: number | null
          review_id?: string | null
          updated_at?: string | null
        }
        Update: {
          base_score?: number | null
          calibration_adjustment?: number | null
          created_at?: string | null
          final_score?: number | null
          review_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_scores_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_scores_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "reviews_employee_view"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews_employee_view: {
        Row: {
          assignment_id: string | null
          created_at: string | null
          cycle_id: string | null
          employee_id: string | null
          finalized_at: string | null
          id: string | null
          reviewer_type: Database["public"]["Enums"]["reviewer_type"] | null
          status: Database["public"]["Enums"]["review_status"] | null
          submitted_at: string | null
          summary_employee_visible: string | null
          updated_at: string | null
        }
        Insert: {
          assignment_id?: string | null
          created_at?: string | null
          cycle_id?: string | null
          employee_id?: string | null
          finalized_at?: string | null
          id?: string | null
          reviewer_type?: Database["public"]["Enums"]["reviewer_type"] | null
          status?: Database["public"]["Enums"]["review_status"] | null
          submitted_at?: string | null
          summary_employee_visible?: string | null
          updated_at?: string | null
        }
        Update: {
          assignment_id?: string | null
          created_at?: string | null
          cycle_id?: string | null
          employee_id?: string | null
          finalized_at?: string | null
          id?: string | null
          reviewer_type?: Database["public"]["Enums"]["reviewer_type"] | null
          status?: Database["public"]["Enums"]["review_status"] | null
          submitted_at?: string | null
          summary_employee_visible?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "review_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "review_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_release_employee_cycle: {
        Args: { p_cycle_id: string; p_employee_id: string }
        Returns: undefined
      }
      admin_reopen_review: { Args: { p_review_id: string }; Returns: undefined }
      assert_minimum_reviews_submitted: {
        Args: { p_cycle_id: string; p_employee_id: string }
        Returns: undefined
      }
      compute_weighted_score: {
        Args: { category_scores: Json; rubric: string }
        Returns: number
      }
      finalize_employee_cycle_summary: {
        Args: {
          p_calibration_adjustment: number
          p_calibration_reason: string
          p_computed_by: string
          p_cycle_id: string
          p_employee_id: string
          p_final_narrative: string
        }
        Returns: undefined
      }
      generate_employee_code:
        | { Args: { p_job_role_id: string }; Returns: string }
        | { Args: { p_role: string }; Returns: string }
      init_cycle_reviewer_rules: {
        Args: { p_cycle_id: string }
        Returns: undefined
      }
      init_cycle_rubrics: { Args: { p_cycle_id: string }; Returns: undefined }
      is_admin:
        | { Args: never; Returns: boolean }
        | { Args: { p_user_id: string }; Returns: boolean }
      make_employee_code: { Args: { p_role: string }; Returns: string }
      next_employee_number: { Args: { p_role: string }; Returns: number }
      rating_to_value: {
        Args: { r: Database["public"]["Enums"]["performance_rating"] }
        Returns: number
      }
      score_to_rating: {
        Args: { score: number }
        Returns: Database["public"]["Enums"]["performance_rating"]
      }
      score_to_rating_value: { Args: { score: number }; Returns: number }
      upsert_employee: {
        Args: { p_hire_date: string; p_id: string; p_job_role_id: string }
        Returns: undefined
      }
      validate_rubric_weights: { Args: { rubric: string }; Returns: undefined }
    }
    Enums: {
      app_user_role: "admin" | "reviewer" | "employee"
      performance_rating: "EXCEEDS" | "MEETS" | "NEEDS_DEVELOPMENT"
      review_cycle_status: "draft" | "calibrating" | "finalized"
      review_status: "draft" | "submitted" | "finalized"
      reviewer_type: "primary" | "self" | "secondary" | "peer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_user_role: ["admin", "reviewer", "employee"],
      performance_rating: ["EXCEEDS", "MEETS", "NEEDS_DEVELOPMENT"],
      review_cycle_status: ["draft", "calibrating", "finalized"],
      review_status: ["draft", "submitted", "finalized"],
      reviewer_type: ["primary", "self", "secondary", "peer"],
    },
  },
} as const
