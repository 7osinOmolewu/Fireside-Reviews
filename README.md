# Fireside Reviews

Fireside Reviews is a role-based performance review system built with:

- Next.js (App Router)
- Supabase (Postgres + RLS + RPC)
- Database-enforced business rules
- Design-forward UI with a warm Fireside theme

This system is database-authoritative.  
All security, workflow locking, release logic, and visibility rules are enforced in Postgres.

The frontend mirrors database state. It does not define it.

---

# Current Status

## UI
- Reviews page redesigned and layout locked
- Full-width responsive layout
- Left navigation restored
- Design theme stabilized (warm Fireside palette)
- Admin UI wiring ongoing
- Employee summary polish pending

## Backend
- Schema stable
- RLS enforced
- Release-per-employee-per-cycle implemented
- Submission locking enforced in DB
- Reviewer rules expansion planned

---

# Design Theme

Fireside design principles:

- Warm neutral base: `#fbf4ec`
- Soft card layers: `#fff7f0`, `#fffdfb`
- Subtle orange borders
- Rounded corners (`rounded-2xl`)
- Soft shadow (`shadow-sm`)
- Avoid harsh white surfaces
- Minimal wasted real estate
- Left navigation, content dominant
- Clean, consistent badge system

The Reviews page layout is considered stable and preferred.

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
  - Functions
  - RPC

Database is the source of truth.

Frontend never decides:
- Visibility
- Score validity
- Submission locks
- Release logic

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
│ └── page.tsx
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
├── supabaseServer.ts
├── supabaseClient.ts
├── requireAdmin.ts
├── me.ts
├── meServer.ts
├── activeCycleClient.ts
├── activeCycleServer.ts
├── cycleLabel.ts
└── getJobRoles.ts

public/
└── brand/
├── fireside-logo.png
└── fireside-mark.png

supabase/
├── migrations/
├── schema.sql
└── seed.sql



---

# Core Model

## Job Roles

- Fully data-driven
- Referenced by UUID
- Never hardcoded
- Admin editable without code changes

## Employees

- Linked to job_roles
- employee_code generated only via SQL trigger
- No PII stored in employee table

## Review Assignments

Generated per cycle.

reviewer_type:
- primary
- secondary
- peer
- self

---

# Review Workflow

1. Admin creates cycle
2. Admin assigns rubrics per job role
3. Assignments generated
4. Reviewers submit narratives
5. Primary reviewer submits scores
6. Admin releases per employee per cycle
7. Employee sees public summary

---

# Release Model (Authoritative)

RPC:

admin_release_employee_cycle(cycle_id uuid, employee_id uuid)

Function behavior:
- Sets released_at
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

| Role               | Can See                         |
|--------------------|--------------------------------|
| Primary Reviewer   | Assigned reviews + scoring     |
| Peer/Secondary     | Narrative-only                 |
| Employee           | Public summary only            |
| Admin              | Everything                     |

Enforced by Postgres RLS.

---

# Submission Locking

When:

reviews.status = 'submitted'

- Narratives immutable
- Scores immutable
- Only admin_reopen_review RPC can unlock
- Enforced by triggers

UI controls are advisory only.

---

# Active Cycle (Global)

Stored in:

public.app_settings  
key = 'active_cycle_id'

Resolution order:

1. ?cycleId= override (admin only, open cycles only)
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
- Server Actions

## Browser Client

lib/supabaseClient.ts

Used in:
- "use client" components only

---

# Regenerate Types

When schema changes:

npx supabase gen types typescript --local > supabase/types/database.types.ts

---

# Dump Schema Snapshot (Optional)

npx supabase db dump --schema public --file schema.sql

Never treat schema.sql as a migration.

---

# DB Invariants (Never Change Without Migration)

- RLS policies
- Foreign key relationships
- review status enum
- scoring model
- audit_log schema
- rubric category codes
- employee_code trigger logic
- summary computation logic
- public visibility rules

All changes must be incremental migrations.

Never edit production schema manually in SQL editor.

---

# Developer Rules

- No lengthy prefaces
- Prefer copy/paste precision
- Do not break working surfaces
- Ask before refactoring stable code
- Design forward
- Avoid rabbit holes
- Smallest viable change first
- Do not replace types with any without justification

---

# Roadmap (Short)

- Reviewer scoring UI polish
- Employee summary UI refinement
- Reviewer rules expansion
- Audit viewer UI
- Role-based dashboard improvements

---

# Important Mental Model

| File                     | Purpose                  | Never Do This                  |
|--------------------------|--------------------------|--------------------------------|
| schema.sql               | Read-only snapshot       | Never use as migration         |
| migrations/*.sql         | Incremental changes      | Never paste pg_dump output     |
| supabase/types/*         | Generated types          | Never hand-edit                |

---

# Local Development Notes

- Supabase CLI manages migrations
- SQL editor bypasses RLS
- UI enforces RLS
- All DB changes must be migrations
- Regenerate types after schema changes
- Regenerate schema.sql only when exporting snapshot

---

# Status

Active development  
Schema stable  
Reviews layout finalized and approved  
Admin wiring ongoing  
Design system stabilized
