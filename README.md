# Fireside Reviews

Fireside Reviews is a role-based performance review system built with:

- Next.js (App Router)
- Supabase (Postgres + RLS + RPC)
- Database-enforced workflow rules
- Role-gated release semantics
- Warm Fireside design system

This system is **database-authoritative**.  
All workflow locking, release logic, scoring, and visibility rules are enforced in Postgres.

The frontend mirrors database state. It does not define it.

---

# Current Status

## UI

- Reviews page layout finalized and stable
- Left navigation restored
- Warm Fireside theme locked
- Reviewer scoring UI working
- Submission locking reflected correctly
- Admin share-with-employee toggle wired
- Toggle no longer full-page refresh
- Toggle optimistic update implemented
- Employee summary view functional
- Admin UI wiring in progress

## Backend

- Schema stable
- `summary_admin_private` permanently removed
- Narrative model unified to:
  - `summary_employee_visible`
- Share flag:
  - `narrative_share_with_employee` (boolean on `reviews`)
- Submission locking enforced in DB
- Per-employee per-cycle release enforced
- Types regenerated and consolidated to:
  - `lib/database.types.ts`
- No duplicate generated types remain

---

# Design Theme

Fireside design principles:

- Warm neutral base: `#fbf4ec`
- Soft card layers: `#fff7f0`, `#fffdfb`
- Rounded corners (`rounded-2xl`)
- Subtle shadow (`shadow-sm`)
- Minimal harsh white
- Content-dominant layout
- Clean badge system
- No unnecessary chrome

The Reviews page layout is considered stable.

---

# Architecture Overview

Frontend (Next.js App Router)
        ↓
Route Handlers / Server Components
        ↓
Supabase Postgres
  - Tables
  - RLS Policies
  - Triggers
  - SQL Functions
  - RPC

Database is the source of truth.

Frontend never decides:
- Visibility
- Submission locks
- Score validity
- Release semantics
- Employee access

---

# Folder Structure (Current)

app/
├── _components/
│ ├── AdminReopenReviewButton.tsx
│ ├── app-nav.tsx
│ ├── app-shell.tsx
│ ├── page-header.tsx
│ ├── PageTransition.tsx
│ ├── user-menu.tsx
│ └── useCycleSelection.ts
│
├── (app)/
│ ├── layout.tsx
│ └── reviews/
│ ├── page.tsx
│ └── [assignmentId]/
│ ├── page.tsx
│ └── review-form.tsx
│
├── admin/
│ ├── employees/
│ ├── assignments/
│ ├── cycles/
│ ├── job-families/
│ ├── page.tsx
│ └── template.tsx
│
├── api/
│ ├── admin/
│ ├── auth/
│ └── reviews/
│   ├── narrative/
│   ├── scores/
│   └── share-narrative/
│
├── auth/
│ └── callback/
│
├── employee/
│ └── page.tsx
│
├── login/
│
├── globals.css
├── layout.tsx
└── page.tsx

lib/
├── database.types.ts
├── supabaseServer.ts
├── supabaseClient.ts
├── requireAdmin.ts
├── me.ts
├── meServer.ts
├── activeCycleClient.ts
├── activeCycleServer.ts
├── cycleLabel.ts
└── getJobRoles.ts

supabase/
├── migrations/
├── schema.sql
└── seed.sql

public/
└── brand/
  ├── fireside-logo.png
  └── fireside-mark.png

---

# Core Data Model

## Job Roles

- Fully data-driven
- Referenced by UUID
- Never hardcoded
- Editable by admin

## Employees

- Linked to `job_roles`
- `employee_code` generated via SQL trigger
- No PII stored in employee table

## Review Assignments

Generated per cycle.

reviewer_type:
- primary
- secondary
- peer
- self

---

# Narrative Model (Updated)

Narrative is unified.

`reviews` table now contains:

- `summary_employee_visible` (text)
- `narrative_share_with_employee` (boolean)

Removed permanently:
- `summary_admin_private`

There is no longer a dual-narrative model.

---

# Review Workflow

1. Admin creates cycle
2. Admin assigns rubrics per job role
3. Assignments generated
4. Reviewers submit narrative
5. Primary reviewer submits scores
6. Admin optionally toggles narrative visibility
7. Admin releases employee (per employee per cycle)
8. Employee sees public summary

---

# Share-With-Employee Toggle

API route:
app/api/reviews/[assignmentId]/share-narrative/route.ts


Server-side guards:

- Review must be `submitted`
- Cycle must not be released for employee
- Caller must be admin

Column updated:
reviews.narrative_share_with_employee


UI:
- Optimistic toggle
- No full-page refresh
- Disabled when:
  - Not admin
  - Review not submitted
  - Employee already released

---

# Submission Locking (DB Enforced)

When:

reviews.status = 'submitted'


- Narrative immutable
- Scores immutable
- Only `admin_reopen_review` RPC unlocks
- Enforced via triggers

UI controls are advisory only.

---

# Release Model (Authoritative)

RPC:

admin_release_employee_cycle(cycle_id uuid, employee_id uuid)


Function behavior:

- Sets `released_at`
- Computes performance rating
- Writes audit_log
- Idempotent
- SECURITY DEFINER
- Admin-gated

Employees never read raw review tables.

They read only:

cycle_employee_summary_public


Guarded by:

released_at IS NOT NULL


---
---

# Release Guard Validation (System Confirmed)

During Feb cycle validation, we confirmed:

- `admin_release_employee_cycle` correctly sets:
  - `released_at`
  - `released_by`
  - `performance_rating_value`
- Release is idempotent
- Employee visibility is gated strictly by:
  - `cycle_employee_summary_public.released_at`
- Employee page reads from:
  - `cycle_employee_summary_public.final_narrative_employee_visible`
- Employee page does **NOT** read from:
  - `reviews.summary_employee_visible`
- Reviewer inbox badges correctly reflect `released_at`
- RLS policies verified and stable

Validation performed via:
- Authenticated debug route
- Direct Postgres queries
- UI login validation as employee

No additional RLS modifications required.

---

# Narrative + Release Integrity

End-to-end workflow confirmed:

1. Reviewer submits narrative  
2. Reviewer commits review  
3. Admin releases employee (per employee per cycle)  
4. Employee sees:
   - Primary narrative  
   - Secondary narrative (if committed)  
   - Only after release  
5. Release badge reflects correct state

There are no remaining dual-narrative remnants.

---

# Release RPC Behavior

RPC:

`admin_release_employee_cycle(cycle_id uuid, employee_id uuid)`

Current behavior:

- Requires existing `cycle_employee_summary_public` row  
- Throws if missing  
- Sets `released_at` and `released_by`  
- Computes `performance_rating_value`  
- Writes to `audit_log`  
- Is idempotent  
- SECURITY DEFINER  
- Admin-gated  

Future optional hardening:

- Add upsert guard to create summary row if missing  
- Not required for current system stability  

---

# RLS State (Verified Stable)

Confirmed policies:

Employees can select:

employee_id = auth.uid()
AND finalized_at IS NOT NULL

---
# Visibility Rules (Non-Negotiable)

| Role             | Can See                          |
|------------------|-----------------------------------|
| Primary Reviewer | Assigned reviews + scoring        |
| Peer/Secondary   | Narrative only                    |
| Employee         | Public summary only               |
| Admin            | Everything                        |

Enforced by Postgres RLS.

---

# Active Cycle (Global)

Stored in:

public.app_settings
key = 'active_cycle_id'


Resolution order:

1. `?cycleId=` override (admin only, open cycles only)
2. app_settings value
3. First open calibrating cycle

All pages must use shared resolver logic.

---

# Supabase Clients

## Server Client

lib/supabaseServer.ts

Used in:
- Server Components
- Route Handlers
- RPC calls

## Browser Client

lib/supabaseClient.ts

Used in:
- `"use client"` components only

---

# Types (Single Source)

Generated types location:

lib/database.types.ts


Regenerate after schema changes:

npx supabase gen types typescript --local > lib/database.types.ts


There must be no duplicate generated type files.

---

# Schema Snapshot
Requires Node >= 20.17.0 for Supabase CLI.
Export snapshot:

npx supabase db dump --schema public --file schema.sql


`schema.sql` is read-only snapshot.

Never treat as migration.

---

# DB Invariants (Do Not Break Without Migration)

- RLS policies
- Review status semantics
- Rubric category codes
- Score-to-rating mapping
- Audit logging schema
- Release semantics
- Employee visibility rules
- FK relationships
- Trigger logic

All DB changes must be incremental migrations.

Never modify production schema manually.

---

# Developer Rules

- No long prefaces
- Prefer copy/paste precision
- Do not break working surfaces
- Ask before refactoring stable code
- Design forward
- Avoid rabbit holes
- Smallest viable change first
- Never duplicate generated types
- Never regenerate types to a different path without updating imports
> Tip: when using `grep`, always exclude generated folders (`node_modules`, `.next`, `.git`) or results will be noisy.
- Note: Git Bash on Windows does not include `rg` (ripgrep) by default — use `grep -RIn --exclude-dir=node_modules --exclude-dir=.next "pattern" .` instead.
---

# Local Development Notes

- Supabase CLI manages migrations
- SQL editor bypasses RLS
- UI respects RLS
- Regenerate types after schema changes
- Regenerate schema snapshot only when exporting baseline

### Node Version Requirement (Supabase CLI)

Some Supabase CLI operations require a newer Node runtime than older local installs.

If you encounter errors such as:

npm ERR! code EBADENGINE  
Required: {"node":"^20.17.0 || >=22.9.0"}  
Actual: {"node":"v20.11.1"}

Upgrade Node using `nvm`:
nvm install 20.17.0
nvm use 20.17.0

Then verify:
node -v

After upgrading, Supabase CLI commands should work normally:
npx supabase db dump --schema public -f supabase/schema.sql
npx supabase gen types typescript --project-id <project-id> --schema public > lib/database.types.ts


This issue is related to Supabase CLI dependency requirements, not the Fireside Reviews project itself.
---
---

# Latest Session Update: Admin UX, Auth, Archives, and Hard Delete

## UI / Navigation

Completed a broader UI rewire across reviewer and admin surfaces.

### Reviewer / App Shell
- `/reviews` remains the main reviewer landing page
- Left navigation updated to:
  - `Dashboard` → `/reviews`
  - `My Performance Review` → `/employee`
- Removed `View My Results` from the top-right user menu
- Added left-rail `Pending Reviews` list
  - shows only assignments pending reviewer completion/submission
  - scoped to current globally active cycle resolution
  - clicking employee name opens the same assignment detail page as `Open review`
- Reviews page retitled in UI to:
  - `Pending Reviews`
  - description reflects active review queue

### Admin Navigation
Admin menu reordered to better match operational workflow:

1. Overview
2. Job Families
3. Cycles
4. Employees
5. Archives
6. Assignments

## Auth / Login

Auth surface expanded beyond magic link.

### Supported login flows
- Google OAuth
- Email + password
- Forgot password
- Reset password
- Admin invite flow for first-time password users

### Notes
- Existing `app/auth/callback/route.ts` was preserved because it correctly:
  - exchanges auth code for session
  - ensures profile exists
  - preserves role state
  - routes user by role
- Login page now supports:
  - Google sign-in
  - email/password sign-in
  - password visibility toggle
- Reset password page now supports:
  - password visibility toggle
  - success-only final state after password update

## Employees Admin Page

`/admin/employees` was fully redesigned to match the Fireside design system.

### Improvements
- Added proper field labels in Add Employee form:
  - Name
  - Email
  - Job Family
  - Hire Date
- Removed redundant `Back to Admin`
- Preserved `Next: Assignments` as workflow CTA
- Reworked employee list into card-based layout
- Improved edit mode presentation and action hierarchy
- Added employee delete action in UI

## Employee Hard Delete

Hard delete is now supported for live employee records.

### Live records removed
- `auth.users`
- `profiles`
- `employees`
- `review_assignments`
- `reviews`
- `review_scores`

### Preserved history behavior
Live cycle summary/history rows are not retained in place, because they cascade on employee delete.

Instead, preserved history is copied into:

- `public.employee_cycle_history_archive`

### Archive preserves
Per employee, per cycle:
- employee name
- employee email
- cycle id / cycle name
- performance rating
- performance rating value
- final employee-visible narrative
- finalized timestamp
- released timestamp
- archived timestamp
- archived by
- source

### Implementation
- Archive-first delete flow implemented through:
  - `public.admin_hard_delete_employee(...)`
- Admin delete route now calls that function from server-side admin API flow
- Delete path validated using rollback-first SQL testing, then live UI/API testing

## Archives Admin View

Added new admin page:

- `/admin/archives`

### Behavior
- Read-only archive of deleted employee review history
- Grouped by deleted employee
- Collapsed row shows:
  - employee
  - email
  - number of archived cycles
  - archived date
  - deleted by
- Expanded view shows per-cycle details
- Per-cycle layout simplified to:
  - cycle name
  - final rating
  - final narrative
  - finalized / released / archived timestamps
- Removed numeric `value` from visible archive UI
- Expand/collapse uses chevron-style up/down icons

## Archive Access / RLS

Archive table required explicit admin read access.

### Current expectation
Admin-only archive visibility is enforced for:
- `employee_cycle_history_archive`

## New / Updated Backend Elements

### New table
- `public.employee_cycle_history_archive`

### New SQL function
- `public.admin_hard_delete_employee(p_employee_id uuid, p_deleted_by uuid)`

### Updated route behavior
- `app/api/admin/employees/[id]/route.ts`
  - supports `PATCH`
  - supports `DELETE`

## Important Operational Notes

- Archive page currently uses newly added archive table, so `lib/database.types.ts` should be regenerated after schema export refresh
- `schema.sql` should be updated from the current project state
- Employee delete behavior is now intentionally destructive for live records, with preserved cycle history stored separately in archive
- Archive UI is read-only and intended for admin audit/reference only

## Current State After This Session

- Reviews UI stable
- Employee view stable
- App shell/navigation significantly improved
- Admin employees page redesigned
- Auth surface expanded and usable
- Hard delete implemented and tested
- Archive history implemented and visible in admin
- Admin panel evolution continuing page by page

# Important Testing Rule

When running SQL that depends on `auth.uid()` or RLS:

Prepend:

select set_config('request.jwt.claim.sub', '<uuid>', true);
select set_config('request.jwt.claim.role', 'authenticated', true);


Run in same SQL batch.

---

# Status

Active development  
Schema stable  
Narrative unified  
Release model stable  
Admin toggle wired  
Reviews layout approved  
Design system stable  
Admin wiring ongoing
Release pipeline verified
Employee visibility confirmed
RLS stable
Reviewer badge alignment correct
No schema changes required
---

## 🧪 Test References (Do Not Delete)

These records are used for validating review flows, release behavior, and admin controls.

### Released + Submitted Employee (Post-Release Validation)

- **Employee Name:** Yemi  
- **employee_id:** `1667c646-44e8-4b66-9dfd-8674a4971081`  
- **cycle_id (Feb cycle):** `4e5b4394-8670-431b-9186-a4232cfbe005`  
- **email:** `tosin.omolewu@gmail.com`  
- **State:**  
  - Review = submitted  
  - Employee cycle = released  

Used for validating:
- Share toggle disabled after release  
- Narrative visibility behavior  
- Employee page rendering post-release  
- Summary + final score display logic  

---

### Admin User (Required for Release + Toggle Tests)

- **Name:** Delia  
- **email:** `tosin@firesidepharmacy.com`  
- **uuid:** `508ea87a-a32a-4674-b912-6c4c19d68894`  
- **Role:** Admin  

Used for validating:
- Share with employee toggle  
- Release employee cycle RPC  
- Admin-only controls  
- RLS admin override policies   

---

## 🔁 Session Restore Checklist

When resuming work:

1. Confirm Feb cycle exists (`4e5b4394-8670-431b-9186-a4232cfbe005`)
2. Confirm Yemi remains released in `cycle_employee_summary_public`
3. Confirm review for Yemi is still `submitted`
4. Confirm Delia can:
   - Toggle narrative (if not released)
   - Release employee cycle
   - Access admin routes

---
