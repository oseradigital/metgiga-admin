# Metgiga Admin — Release 1 architecture decisions

Status: **proposed, awaiting confirmation.** No migrations have been written and no
CRM screens have been built against this. This document is the record of the
decisions made before that happens, per blueprint Section 41 ("explain major
architectural decisions before implementation").

## 0. Codebase split — noted deviation from the blueprint's stated default

Blueprint Section 32 says the *preferred* direction is one Next.js codebase with
route groups (`(client)` / `(admin)`), splitting "only when justified." The founder's
instruction for this release was explicit: a new, separate project, not an extension
of `metgiga-portal`. That's what's been scaffolded (`~/Downloads/metgiga-admin`,
separate git repo, separate `npm install`).

This is flagged, not silently followed, because it's a real deviation from the
document's own default. It's also a defensible one under the blueprint's own escape
hatch ("split only when justified"): admin.metgiga.com and portal.metgiga.com are
different audiences with completely different auth models, and keeping them in
separate deployments means a bad admin-side deploy can never take the live client
onboarding portal down, and vice versa. If this was actually meant to be one
codebase, say so now — it's cheap to fold back in at this stage, expensive later.

## 1. Project scaffold

Done: `create-next-app` with TypeScript, Tailwind v4, App Router, no `src/` dir,
`@/*` import alias — matching `metgiga-portal`'s conventions exactly. Dependency
versions pinned to match the portal (`@supabase/ssr`, `@supabase/supabase-js`, `zod`,
`lucide-react`). Builds and typechecks clean. No auth, no data model, no CRM UI yet —
that's what items 2–4 below need confirming before they get built.

## 2. Supabase: shared project, separate schema

**Recommendation: share the existing Supabase project. Put every admin/CRM table in
a new Postgres schema, `crm`, not in `public` alongside `onboarding_records`,
`signatures`, etc.**

Reasoning:

- **Real foreign keys later.** Blueprint Section 15 has organisations eventually
  creating `onboarding_records` automatically after payment (Release 4), and Section
  20 shows `payments`/`agreements` referencing organisation/deal/proposal ids. If
  admin and client data live in the same Postgres database, `crm.organisations.id`
  can be a real FK target from `public.onboarding_records` (a nullable
  `organisation_id` column added in a future release) — enforced by the database, not
  just app code discipline. A separate Supabase project can't do this; cross-project
  references would be unenforced UUIDs matched by convention, which is exactly the
  kind of silent-failure risk Section 38 (reliability principle) warns about.
- **One auth system, deliberately.** Supabase Auth is project-wide — one
  `auth.users` table. Sharing the project means Saif/cofounder (admin) and clinic
  contacts (client portal) are both rows in the same `auth.users`, distinguished by
  which profile table they appear in (`crm.team_members` vs. `onboarding_records.auth_user_id`).
  This is a completely standard pattern (one auth table, multiple audience-specific
  profile tables) and it's what makes future features like "admin sees which client
  user is logged in right now" possible without juggling two identity systems.
- **Schema-level isolation still holds.** A separate `crm` schema means admin tables
  are never visually or operationally mixed into `public` — different privilege
  grants, different RLS review, `\dn`/`\dt crm.*` cleanly shows what belongs to the
  internal system vs. the client-facing one. This satisfies the actual concern behind
  "keep admin data logically isolated" without the cost of a second project (separate
  billing, separate connection pooling, no cross-project FKs, and — per blueprint
  Section 31 — no stated reason yet that justifies it).

One real setup step this requires: Supabase only exposes the `public` schema over
the PostgREST API by default. `crm` needs to be added under **Project Settings → API
→ Exposed schemas** before the app can query it via the Supabase JS client
(`supabase.schema("crm").from("organisations")...`). I'll do this at migration time,
not before — no point exposing an empty schema.

**Alternative considered and rejected:** a second, separate Supabase project purely
for admin. Rejected because it forecloses the real-FK cross-linking the blueprint's
own Release 4 design depends on, for an isolation benefit the `crm` schema already
delivers.

## 3. Authentication — two real named accounts, extensible

**Design:**

- Real Supabase Auth accounts (email + password), created for Saif and the
  cofounder specifically — not a shared login, not a placeholder. I create these
  directly via the Supabase Admin API (`auth.admin.createUser`) once you confirm
  each person's email; there is no public sign-up route on admin.metgiga.com, ever.
- A `crm.team_members` table gates access: `id` (references `auth.users.id`),
  `full_name`, `email`, `role`, `is_active`, `created_at`. Every RLS policy on every
  `crm.*` table checks membership in this table — being a valid Supabase Auth user is
  necessary but not sufficient; you also have to be a row in `team_members` with
  `is_active = true`. This is what stops a client-portal account from ever reaching
  admin data even though it's technically the same Supabase project.
- `role` is a text column (`owner`, `sales`, `account_manager`, `production` — the
  roles blueprint Section 29 names) with a check constraint, populated now but **not
  enforced yet.** For Release 1, both of you get full read/write visibility per your
  explicit instruction ("both users should see all deals"). The column exists so that
  Release 6-era permission tightening (Section 29's per-role scoping) is a policy
  change, not a schema migration and a rebuild.
- Adding a third team member later: I insert a row into `auth.users` (Admin API) and
  `crm.team_members` — no code change, no redeploy. A proper "invite teammate" UI is
  a small, safe fast-follow once there are actually more than two of you; it's not
  gating Release 1's definition of done per the blueprint's own criteria (Section 33:
  "the co-founder can log in" is the bar, not "the co-founder can invite people").
- Session handling: identical `@supabase/ssr` pattern to the portal
  (`lib/supabase/client.ts`, `lib/supabase/server.ts`, a `proxy.ts` refreshing the
  session on every request) — proven, already audited this session for the portal.
  **Important isolation point:** admin.metgiga.com and portal.metgiga.com are
  different subdomains, so their session cookies are separate by default and I will
  not widen the cookie domain to share them. Logging into one never logs you into
  the other, and a stolen/leaked client-portal session cookie is useless against
  admin.

I have not written any of this yet (no `lib/supabase/*`, no `proxy.ts`, no login
route) — it's designed here, waiting on your confirmation of item 2 first, since the
schema/exposed-API decision above is a precondition for the RLS policies this auth
model depends on.

## 4. Release 1 data model (proposed — not yet migrated)

Scope, per blueprint Section 33's Release 1 list and your explicit spec: organisations,
contacts, deals + pipeline, activity timeline, tasks, RLS. No proposals, no
agreements, no payment automation — those stay Release 2/3.

### `crm.team_members`
Already described above (§3). Not a client-facing "contact" — this is *your* team.

### `crm.organisations`
One row per clinic/business, prospect through client.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| name | text not null | |
| legal_name | text | nullable |
| website | text | nullable |
| industry | text | nullable, free text for now |
| status | text, check enum | `prospect`, `activating`, `active`, `paused`, `cancelled`, `lost` (blueprint §20) |
| created_by | uuid, default `auth.uid()` | see attribution note below |
| created_at | timestamptz default now() | |
| updated_at | timestamptz default now() | |

### `crm.contacts`
People at an organisation.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| organisation_id | uuid, fk → organisations, not null | |
| first_name | text not null | |
| last_name | text | nullable |
| email | text | nullable, not unique — same person can recur |
| phone | text | nullable |
| role | text | their job title/role, free text |
| is_primary | boolean default false | |
| created_by | uuid, default `auth.uid()` | |
| created_at | timestamptz default now() | |

### `crm.deal_stages` (lookup table, not a Postgres enum)
Deliberately a table, not an `enum` type. Postgres enums can't be reordered and are
awkward to extend later; a real pipeline that's a few weeks old always ends up
wanting a stage renamed or reordered. A lookup table makes that a data change, not a
schema migration.

| id (text pk) | label | sort_order | is_won | is_lost |
|---|---|---|---|---|
| `discovery_booked` | Discovery Booked | 10 | false | false |
| `discovery_complete` | Discovery Complete | 20 | false | false |
| `proposal` | Proposal | 30 | false | false |
| `verbal_yes` | Verbal Yes | 40 | false | false |
| `proposal_sent` | Proposal Sent | 50 | false | false |
| `proposal_viewed` | Proposal Viewed | 60 | false | false |
| `proposal_accepted` | Proposal Accepted | 70 | false | false |
| `agreement_signed` | Agreement Signed | 80 | false | false |
| `payment_pending` | Payment Pending | 90 | false | false |
| `payment_completed` | Payment Completed | 100 | false | false |
| `deal_won` | Deal Won | 110 | true | false |
| `lost` | Lost | 120 | false | true |

The first 11 rows are exactly your Section-5-derived list, in your order. **`lost` is
an addition, not something you asked for — flagging it explicitly rather than adding
it silently.** Reasoning for proposing it anyway: a real pipeline needs a terminal
state for deals that don't close, and blueprint Section 20 already lists a
`lost_reason` field on `deals` and Section 19's own pipeline sketch has a `LOST`
column — so the blueprint assumes it exists, it just didn't make it into your
Section-5 list (which reads as the *happy path* journey, not the full state
machine). Tell me if you'd rather leave `lost` out of Release 1 and just let stalled
deals sit in whatever stage they're in.

### `crm.deals`

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| organisation_id | uuid, fk → organisations, not null | |
| primary_contact_id | uuid, fk → contacts | nullable |
| title | text not null | e.g. "Aurora Aesthetics — Full Funnel" |
| stage | text, fk → deal_stages, not null, default `discovery_booked` | |
| package | text | `Creative` / `Growth` / `Full Funnel` / `Custom` — free text in Release 1, no package catalogue table yet (that's Release 2, proposals) |
| monthly_value | numeric | estimated/agreed MRR, nullable |
| currency | text default `'GBP'` | |
| expected_start_date | date | nullable |
| owner_user_id | uuid, fk → team_members | who's running the deal |
| source | text | nullable, free text |
| next_action | text | nullable |
| lost_reason | text | nullable, only meaningful when stage = `lost` |
| created_by | uuid, default `auth.uid()` | |
| created_at | timestamptz default now() | |
| updated_at | timestamptz default now() | |

A trigger on `crm.deals` (`AFTER UPDATE OF stage`) writes a `deal.stage_changed`
row into `activity_events` automatically. This isn't left to app code to remember —
per blueprint Section 38's reliability principle, the timeline has to be right even
if some future code path updates `stage` directly and forgets to log it by hand.

### `crm.activity_events`
The timeline. One generic table, not a separate `notes` table — a note is just an
event with `event_type = 'note.added'` and the text in `metadata`. Blueprint Section
41 says avoid duplicate tables/components; a second notes table with its own RLS
policy would just be this table's job done twice.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| organisation_id | uuid, fk → organisations | denormalised for fast per-org timeline queries |
| actor_id | uuid, default `auth.uid()`, fk → team_members | nullable, null = system-generated |
| event_type | text not null | `deal.created`, `deal.stage_changed`, `note.added`, `task.created`, `task.completed`, etc. |
| entity_type | text not null | `deal`, `organisation`, `contact`, `task` |
| entity_id | uuid not null | |
| metadata | jsonb | e.g. `{"from": "proposal", "to": "verbal_yes"}` or `{"text": "..."}` for notes |
| created_at | timestamptz default now() | |

### `crm.tasks`

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| organisation_id | uuid, fk → organisations | nullable — a task can be general |
| deal_id | uuid, fk → deals | nullable |
| assigned_to | uuid, fk → team_members | nullable |
| created_by | uuid, default `auth.uid()` | |
| title | text not null | |
| description | text | nullable |
| due_at | timestamptz | nullable |
| status | text, check enum, default `'open'` | `open`, `done` |
| priority | text, check enum | `low`, `normal`, `high` |
| created_at | timestamptz default now() | |
| updated_at | timestamptz default now() | |

### RLS — full visibility, non-spoofable attribution

Per your explicit instruction: both of you see everything (small team, full
visibility); writes are attributed accurately for the timeline to mean something.
The pattern, applied to every `crm.*` table:

```sql
-- SELECT: any active team member sees everything.
create policy "team can view all <table>"
  on crm.<table> for select
  to authenticated
  using (exists (
    select 1 from crm.team_members
    where id = auth.uid() and is_active
  ));

-- INSERT/UPDATE: any active team member can write, but attribution
-- columns (created_by / actor_id) must equal the caller's own id —
-- default fills it in if omitted, `with check` rejects any attempt to
-- write a different one.
create policy "team can insert <table>"
  on crm.<table> for insert
  to authenticated
  with check (
    exists (select 1 from crm.team_members where id = auth.uid() and is_active)
    and created_by = auth.uid()
  );
```

This is the same "don't trust the client" principle already applied throughout the
onboarding portal this session — the column *default* is a convenience, the RLS
`with check` is what actually prevents Saif's account from writing rows that claim
to be the cofounder's, or vice versa.

`crm.team_members` itself has no client-facing insert/update policy at all — that
table is only ever written by the service role (me, adding people), matching the
"invite-only, no self-service" design in §3.

---

## What I need from you before I write the migration

1. Confirm the `crm` schema-in-shared-project decision (§2), or say you want a fully
   separate Supabase project instead.
2. Confirm both your and your cofounder's email addresses so I create the two real
   Supabase Auth accounts.
3. Confirm the `deal_stages` table including the added `lost` stage, or tell me to
   drop it / handle it differently.
4. Anything you want changed in the `organisations` / `contacts` / `deals` /
   `activity_events` / `tasks` field lists above.

Nothing below this point exists yet: no migration file, no RLS policy, no login
page, no CRM screen.
