# Fireside Reviews

Fireside Reviews is a role-based performance review system built with **Next.js (App Router)** and **Supabase**.

It supports structured review cycles, **job-family–specific performance standards**, controlled visibility of ratings, and admin-managed workflows, with business rules enforced **in Postgres**, not the frontend.

This project is developed **locally-first**, with Supabase as the system of record.

---

## 🎯 Project Goal

Build a flexible, auditable performance review platform where:

- Performance standards are defined **per job family**
- All employees in a job family are evaluated against the **same rubric**
- Admins can manage job families, review forms, and assignments **without code changes**
- Review visibility is enforced **at the database layer (RLS + triggers + functions)**
- The frontend can evolve or be replaced without rewriting backend logic

---

## 🧠 Core Concepts

### Job Families (Job Roles)

**Table:** `job_roles`

- Fully data-driven
- Never hardcoded
- Referenced only by `job_roles.id` (UUID)

Admins may add or rename job families at runtime without code changes.

---

### System Roles (Access Only)

System roles control **permissions**, not performance standards:

- `admin`
- `reviewer`
- `employee`

Enforced via:
- `admin_users`
- RLS
- API guards

---

## 👥 Profiles vs Employees

### `profiles`
- Identity only (name, email)
- Mirrors `auth.users`
- RLS enforced

### `employees`
- Employment metadata
- `job_role_id`, `employee_code`
- No PII

Employee codes are generated **only in SQL** and never edited.

---

## 📝 Review Model

### Review Requirements

- Self review required
- Primary review required
- Peer / secondary optional

Enforced by SQL, not UI.

---

## 🧮 Scoring & Calibration

- Rubrics defined per cycle and job role
- Category weights must sum to `100`
- Scores are stored per review
- Final aggregation and rating is computed server-side

### Rating Scale

| Rating | Value |
|------|------|
| EXCEEDS | 5 |
| MEETS | 3 |
| NEEDS_DEVELOPMENT | 1 |

Mapped via `score_to_rating(score numeric)`.

---

## 🔓 Admin Release Semantics (Authoritative)

Admin releases performance results **per employee per cycle** using:

admin_release_employee_cycle(cycle_id, employee_id)
yaml

The function:

- Sets `released_at`
- Sets `released_by`
- Derives `performance_rating_value`
- Writes an audit log entry
- Is **idempotent**

Enforced by:
- `SECURITY DEFINER`
- Admin gate
- SQL as the source of truth

---

## 👀 Employee Visibility (Strict)

Employees **never** read from:

- `reviews`
- `review_scores`
- `cycle_employee_summary`

Employees read **only** from:

- `cycle_employee_summary_public`

Visible **only when `released_at IS NOT NULL`**.

### Employee-visible fields

- `performance_rating`
- `performance_rating_value`
- `final_narrative_employee_visible`
- `released_at`

---

## 🔐 Visibility Rules (Non-Negotiable)

| Viewer | Can See |
|------|--------|
| Reviewer | Assigned reviews only |
| Employee | Released public summary only |
| Admin | Everything |

No frontend conditionals enforce this.  
**All enforcement is in Postgres.**

---

## 🧾 Audit Logging

All admin release actions are logged to:

- `audit_log`

Each entry records:

- `actor_user_id`
- `action`
- `entity_type`
- `entity_id`
- `before_state`
- `after_state`
- `created_at`

---

## 🧱 Architecture Overview

### High-level Architecture
┌────────────────────────┐
│ Frontend │
│ Next.js App Router │
│ │
│ - Reviewer UI │
│ - Admin UI │
│ - Employee UI │
│ │
│ Non-authoritative │
└──────────┬─────────────┘
│
▼
┌────────────────────────┐
│ API / Server Layer │
│ │
│ - Route Handlers │
│ - Server Components │
│ - RPC calls │
│ │
│ Guards only │
└──────────┬─────────────┘
│
▼
┌────────────────────────┐
│ Supabase Postgres │
│ │
│ - Tables │
│ - RLS Policies │
│ - Triggers │
│ - SQL Functions │
│ │
│ SOURCE OF TRUTH │
└────────────────────────┘


---

## 🗄️ Core Tables

### Identity & Access
- `profiles`
- `admin_users`

### Organization
- `employees`
- `job_roles`

### Cycles & Assignments
- `review_cycles`
- `review_assignments`

### Reviews & Scoring
- `reviews`
- `review_scores`

### Rubrics
- `rubrics`
- `cycle_rubrics`
- `rubric_categories`
- `rubric_questions`

### Rollups & Publication
- `cycle_employee_summary`
- `cycle_employee_summary_public`

### Audit
- `audit_log`

---

## ⚠️ Database Invariants (Never Break Without Migration)

- RLS policies
- Review status semantics
- Rubric category codes
- Score-to-rating mapping
- Public summary visibility rules
- Audit logging behavior

All DB changes must be done via **incremental migrations**.

---

## 🧭 Current Status

- ✅ Reviewer flow stable
- ✅ Admin calibration model implemented
- ✅ Release-per-employee-per-cycle implemented
- 🚧 Admin UI wiring next
- 🚧 Employee view polish later

---

## 🚀 Next Step

Wire the **Admin “Release Review”** button to call:

rpc('admin_release_employee_cycle', { cycle_id, employee_id })
yaml

### Requirements

- Admin-only
- Disabled if already released
- UI reflects release state immediately
- No frontend authority over visibility

---

## Developer Principles

- Database is the source of truth
- UI mirrors DB state
- Prefer incremental, reversible changes
- Never bypass RLS in production

## 👀 Visibility Rules (Non-Negotiable)

Enforced via **Postgres RLS + triggers**, never frontend logic.

| Viewer | Can See |
|------|--------|
| Primary reviewer | Scores + narratives (as permitted) |
| Secondary / Peer | Narrative-only (current default) |
| Employee | Employee-visible narrative + rating |
| Admin | Everything |

Raw scores and calibrations are never exposed unless explicitly allowed.

---

### Submission Locking (DB-Enforced)
Once `reviews.status = 'submitted'`:
- Reviewer narratives are immutable
- Admin override exists (admin_reopen_review)
- Scores are immutable
- Enforcement is handled via Postgres triggers
- UI controls are advisory only

Admin overrides
List:
- Reopen submitted reviews (RPC-backed)
- Guarded by requireAdmin

---

## Design Notes: Cycle Name Resolution
Cycle names are intentionally resolved without relying on PostgREST embedded joins.

### Rationale
- Although foreign keys are correctly defined, embedded joins for `review_cycles`
  were returning `null` inconsistently in the API response.
- To avoid fragile PostgREST behavior and unblock development, cycle names are
  resolved explicitly by:
  1. Fetching open review cycles separately
  2. Building an in-memory map of `cycle_id → cycle_name`
  3. Rendering cycle names from `review_assignments.cycle_id`

This approach is:
- Explicit
- Deterministic
- Easy to reason about
- Reversible if embedded joins are stabilized later

---

## Types
Note: 
- supabase/types/database.types.ts is generated
- Must be regenerated when new RPCs or tables are added

---

## 🔐 Authentication & Supabase Clients

Two Supabase clients are **intentional and required**.

### 1️⃣ Server client — `lib/supabaseServer.ts`

Used in:
- Server Components
- Route Handlers (`app/api/**`)
- Server Actions

Includes a required cookie write guard to avoid Next.js App Router errors.

### 2️⃣ Browser client — `lib/supabaseClient.ts`

Used in:
- `"use client"` components only
- Browser-side reads and future realtime usage

---

## 🧩 Review Flow (Simplified)

1. Admin creates a review cycle
2. Admin assigns:
   - Job families → rubrics
   - Employees → job families
3. Review assignments are generated
4. Reviewers submit narratives
5. Primary reviewer submits scores
6. Admin releases calibration
7. Employee sees finalized summary

---

## 📂 Repo Structure
app/
├── admin/
│ ├── employees/
│ ├── job-families/
│ ├── assignments/
│ └── cycles/
├── reviews/
│ ├── page.tsx
│ └── [assignmentId]/
│ ├── page.tsx
│ └── review-form.tsx
├── api/
│ ├── admin/
| ├── auth /
│ └── reviews/
├── auth / callback /
├── employee/ 
├── login/
├──components/
│  ├── AdminReopenReviewButton
│  ├── PageTransition
│  ├── useCycleSelection
├──lib/
│  ├── supabaseServer.ts
│  ├── supabaseClient.ts
│  ├── requireAdmin.ts
│  ├── me.ts
│  ├── meServer.ts
│  ├── activeCycleClient.ts
│  ├── activeCycleServer.ts
│  ├── cycleLabel.ts
│  └── getJobRoles.ts

supabase/
├── migrations/
├── schema.sql
└── seed.sql

yaml

---

## Active Cycle (Global)

### What it is
The app uses a single **global active cycle** that all pages default to when no explicit cycle is provided.

### Where it’s stored
Stored in the `public.app_settings` table as a single row:

- `key` = `active_cycle_id`  
- `value` = `<uuid of review_cycles.id>`

### Resolution order
The active cycle is resolved in the following order:

1. **Admin override via query param**  
   `?cycleId=` (only honored if the cycle is open)

2. **Global active cycle**  
   Value from `app_settings.active_cycle_id`

3. **Fallback**  
   First open cycle with status `calibrating`

### How to change it (Admin)
Choose one of the following approaches (recommended option noted):

- **Admin UI screen**  
  Provide an internal admin-only screen that allows selecting and saving the active cycle.

- **Admin-only API route (recommended)**  
  Create a protected API route that updates `public.app_settings` where  
  `key = 'active_cycle_id'`.

### Developer notes
- Pages **must not** resolve cycles independently.
- All cycle resolution must go through a **shared resolver helper**.
- Keep the logic in one place to prevent drift and inconsistent behavior.

### Troubleshooting
- **Next.js runtime error (params/searchParams Promise)**  
  If you see an error related to accessing `params` or `searchParams`, ensure you `await`  
  `props.params` and `props.searchParams` before reading their properties.

- **Supabase typing issues with `.from("app_settings")`**  
  If typing fails:
  - Regenerate Supabase types, **or**
  - Use a temporary typed escape hatch until types are regenerated.

## 🧪 Local Development Notes

- Supabase CLI is used for migrations
- `schema.sql` is a read-only snapshot
- SQL Editor bypasses RLS; UI does not
- All DB changes must be incremental migrations

---

## ⚠️ What Can Break in Prod

1. Missing `employee_code_prefix` in new job roles
2. RLS blocking admin reads on `profiles`
3. Rubric category mismatch vs submitted scores
4. Reintroduction of legacy DB functions
5. Forgetting to regenerate `schema.sql`

---

## Regenerate schema.sql only when:
- Squashing migrations
- Creating a new project baseline
- Exporting schema for external review

---

## 🚫 Things You Should Never Change Without a Migration (DB Invariants)

This project treats **Supabase Postgres as the source of truth**. Any change to tables, constraints, triggers, functions, enums, or RLS policies must be done via an **incremental migration** (never ad-hoc in the SQL editor).

### 1) Primary keys, foreign keys, and relationship columns
Do not change or drop these without a migration:
- Any table `id` column defaults (e.g., `gen_random_uuid()`)
- Foreign key columns like:
  - `employees.job_role_id`
  - `review_assignments.cycle_id`, `review_assignments.employee_id`, `review_assignments.reviewer_id`
  - `reviews.assignment_id`, `reviews.cycle_id`, `reviews.employee_id`, `reviews.reviewer_id`
  - `review_scores.review_id`
  - `cycle_rubrics.cycle_id`, `cycle_rubrics.rubric_id` (and `job_role_id` if used)

If you change FK relationships, PostgREST nested selects and RLS assumptions will break.

---

### 2) RLS policies (and anything that affects visibility)
Never “quick edit” RLS in production:
- `profiles` policies (admin reads + self reads)
- reviewer visibility policies for:
  - `review_assignments`
  - `reviews`
  - `review_scores`
- employee visibility policies for:
  - `cycle_employee_summary_public`
  - employee-safe narrative fields

RLS is part of the app’s security model. Changes must be reviewed, migrated, and tested.

---

### 3) Triggers and functions that enforce invariants
These are core business rules and must only be changed in migrations:

**Employee codes**
- `generate_employee_code(job_role_id uuid)`
- `set_employee_code()` trigger on `employees`
- `employee_code_counters` behavior

**Review requirements and finalization**
- `assert_minimum_reviews_submitted(cycle_id, employee_id)`
- `finalize_employee_cycle_summary(...)`

**Scoring enforcement**
- `trg_primary_only_scores` / enforcement function that prevents non-primary scoring (until reviewer_rules is wired)

If any of these break, the UI may still appear to work but the database will become inconsistent.

---

### 4) Review status model (workflow semantics)
Do not change these without a migration and corresponding backend enforcement updates:
- `reviews.status` enum values (e.g., `draft`, `submitted`, `finalized`)
- `submitted_at` / `finalized_at` expectations
- Any logic that assumes “submitted reviews are immutable” (submission locking)

The workflow semantics are used across API routes, SQL logic, and reporting tables.

---

### 5) Rubric structure and how scoring keys are derived
Never change rubric tables casually:
- `rubrics`
- `cycle_rubrics`
- `rubric_categories`
- `rubric_questions`

Also: be careful with any column that determines how `review_scores.category_scores` keys are created:
- If you use `rubric_categories.code` or similar as keys, changing those values can orphan historical scores.
- If you switch from `code`-keys to `id`-keys, do it with a migration and backfill plan.

---

### 6) Audit & summary tables
These tables reflect downstream derived state:
- `cycle_employee_summary`
- `cycle_employee_summary_public`
- `audit_log`

Any schema changes require updating the SQL that writes to them (especially finalization logic).

---

### 7) PostgREST expectations (nested selects)
If you remove or change foreign keys, nested selects will fail with errors like `PGRST200`.
Known dependency chains:
- `review_assignments` → `reviews` (by FK on `reviews.assignment_id`)
- `reviews` → `review_scores` (by FK on `review_scores.review_id`)

Breaking these breaks the reviewer UI and server queries.

---

### 8) Anything referenced by the frontend or API contracts
These fields are part of an implicit contract:
- `reviews.summary_reviewer_private`
- `reviews.summary_employee_visible`
- `reviews.status`
- `review_scores.category_scores`
- `review_assignments.reviewer_type`

If you rename/remove these without a migration + code updates, the UI and API routes will fail.

---

### 9) Never treat the SQL editor as a “deployment mechanism”
- SQL Editor is fine for exploration.
- Do not apply production changes there.
- Migrations must be the only source of schema evolution.

---

### 10) Always regenerate schema.sql after schema changes
`schema.sql` is a snapshot used for debugging and sharing context.
After applying migrations:
`bash`
npx supabase db dump --schema public --file schema.sql

---
makefile
::contentReference[oaicite:0]{index=0}

---
## Developer Principles (Important)
- Avoid rabbit holes. Fix the smallest broken surface first.
- Do not change existing working code unless explicitly required.
- Do not replace types with `any` unless there is a documented reason.
- If a better approach exists, propose it first and explain tradeoffs briefly.
- Prefer clarity and correctness over refactors.

## 🧭 Roadmap (Short)

- Finish rubric-driven scoring UI
- Enforce submission locking in SQL
- Wire `reviewer_rules` into scoring enforcement
- Build employee-facing summary view

---

## Status

🚧 Active development  
Schema stable, admin flows working, reviewer flow in progress


## Important Mental model
| File               | Purpose             | Never do this            |
| ------------------ | ------------------- | ------------------------ |
| `schema.sql`       | Read-only snapshot  | ❌ Never use as migration |
| `migrations/*.sql` | Incremental changes | ❌ Never paste pg_dump    |
| baseline           | Anchor point        | ✅ Can be empty           |
| future migrations  | Real changes        | ✅ One change per file    |


### Admin action: how to “release” a review
Admin just sets finalized_at.

Release one review:
  update public.reviews
  set finalized_at = now()
  where id = '<review_id>';

Unrelease (hide again):
  update public.reviews
  set finalized_at = null
  where id = '<review_id>';
You can wire this to an admin button later (API route), but SQL alone proves the model works.

If you want cycle-wide release too (later), you’d add a new cycle status like released, then update the view:

and (
  r.finalized_at is not null
  or exists (
    select 1
    from public.review_cycles c
    where c.id = r.cycle_id
      and c.status in ('released','closed')
  )
)
But again: you don’t have those statuses yet, so don’t add complexity until you need it.

## release per employee per cycle 
your employee-facing “View Results” should primarily use:

cycle_employee_summary_public (guarded by released_at is not null)

optionally a safer rollup view for scores (only final_score + rating, no category breakdown unless you want it)

And you can leave reviews_employee_view as-is for later, or repurpose it if you decide employees should see per-review narratives after release.

## Cycle Management (Admin)

The **Manage Cycles** page now supports setting the **global active review cycle**.

### What’s new
- Admins can designate a cycle as the **current (global active) cycle** directly from the **Manage Cycles** page.
- The active cycle is stored centrally and applied consistently across the app.
- On load, the system:
  - Selects the global active cycle if one exists.
  - Falls back to the most recent open cycle if none is set.
- The UI clearly indicates when the selected cycle is the current global cycle.

### Implementation details
- Global active cycle is persisted via the `app_settings` table (`active_cycle_id`).
- Admin-only API endpoints handle reading and updating the active cycle.
- Existing cycle creation, editing, and rubric-mapping functionality remains unchanged.
