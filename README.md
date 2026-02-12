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

---

# Local Development Notes

- Supabase CLI manages migrations
- SQL editor bypasses RLS
- UI respects RLS
- Regenerate types after schema changes
- Regenerate schema snapshot only when exporting baseline

---

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