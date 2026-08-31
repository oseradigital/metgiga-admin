-- Metgiga Admin — Release 1: internal CRM schema.
-- Runs against the SAME Supabase project as metgiga-portal
-- (wriwcjkkqxmkkyiahvml), in a new `crm` schema — deliberately not
-- `public`, which stays reserved for the client-facing onboarding portal
-- (onboarding_records, signatures, ad_account_status, documents,
-- reports). See docs/release-1-architecture.md for the full reasoning.
--
-- After this migration runs, `crm` must be added under Project Settings
-- -> API -> Exposed schemas before the app can query it via
-- supabase.schema("crm") — Supabase only exposes `public` over the API
-- by default.

create schema if not exists crm;

-- ---------------------------------------------------------------------
-- team_members — gates access to every table below. Being a valid
-- Supabase Auth user is necessary but not sufficient for admin access;
-- you also need an active row here. No insert/update/delete policy for
-- `authenticated` at all (see bottom of file) — accounts are created
-- only by the service role (me, via the Admin API), matching the
-- "invite-only, no self-service signup" design.
-- ---------------------------------------------------------------------
create table crm.team_members (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  -- Populated now, not enforced yet — Release 1 gives both of you full
  -- read/write visibility per explicit instruction. This column exists
  -- so a later permission tightening (blueprint Section 29's per-role
  -- scoping) is a policy change, not a schema migration + rebuild.
  role text not null check (role in ('owner', 'sales', 'account_manager', 'production')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- organisations
-- ---------------------------------------------------------------------
create table crm.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  website text,
  industry text,
  status text not null default 'prospect'
    check (status in ('prospect', 'activating', 'active', 'paused', 'cancelled', 'lost')),
  created_by uuid not null default auth.uid() references crm.team_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------
create table crm.contacts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references crm.organisations(id) on delete cascade,
  first_name text not null,
  last_name text,
  email text,
  phone text,
  role text,
  is_primary boolean not null default false,
  created_by uuid not null default auth.uid() references crm.team_members(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- deal_stages — a lookup table, not a Postgres enum. Enums can't be
-- reordered and are awkward to extend; a pipeline that's a few weeks
-- old always wants a stage renamed or reordered eventually, and that
-- should be a data change, not a migration.
--
-- Rows 1-11 are the founder's exact Section-5-derived order. `lost` is
-- an addition (confirmed with the founder, not silently added) — a real
-- pipeline needs a terminal state for deals that stall, and blueprint
-- Section 20 already assumes a `lost_reason` field exists.
-- ---------------------------------------------------------------------
create table crm.deal_stages (
  id text primary key,
  label text not null,
  sort_order integer not null,
  is_won boolean not null default false,
  is_lost boolean not null default false
);

insert into crm.deal_stages (id, label, sort_order, is_won, is_lost) values
  ('discovery_booked',   'Discovery Booked',   10,  false, false),
  ('discovery_complete', 'Discovery Complete', 20,  false, false),
  ('proposal',           'Proposal',           30,  false, false),
  ('verbal_yes',         'Verbal Yes',         40,  false, false),
  ('proposal_sent',      'Proposal Sent',      50,  false, false),
  ('proposal_viewed',    'Proposal Viewed',    60,  false, false),
  ('proposal_accepted',  'Proposal Accepted',  70,  false, false),
  ('agreement_signed',   'Agreement Signed',   80,  false, false),
  ('payment_pending',    'Payment Pending',    90,  false, false),
  ('payment_completed',  'Payment Completed', 100,  false, false),
  ('deal_won',           'Deal Won',          110,  true,  false),
  ('lost',               'Lost',              120,  false, true);

-- ---------------------------------------------------------------------
-- deals
-- ---------------------------------------------------------------------
create table crm.deals (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references crm.organisations(id) on delete cascade,
  primary_contact_id uuid references crm.contacts(id) on delete set null,
  title text not null,
  stage text not null default 'discovery_booked' references crm.deal_stages(id),
  package text,
  monthly_value numeric,
  currency text not null default 'GBP',
  expected_start_date date,
  owner_user_id uuid references crm.team_members(id),
  source text,
  next_action text,
  -- Only meaningful when stage = 'lost'; not constrained to require it,
  -- since a deal can be marked lost and the reason filled in a moment
  -- later rather than atomically.
  lost_reason text,
  created_by uuid not null default auth.uid() references crm.team_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deals_organisation_id_idx on crm.deals(organisation_id);
create index deals_stage_idx on crm.deals(stage);

-- ---------------------------------------------------------------------
-- activity_events — the timeline. One generic table, not a separate
-- notes table: a note is just an event with event_type = 'note.added'
-- and the text in metadata. Avoids a duplicate table doing the same
-- job with its own RLS policy (blueprint Section 41: avoid duplicate
-- tables/components).
-- ---------------------------------------------------------------------
create table crm.activity_events (
  id uuid primary key default gen_random_uuid(),
  -- Denormalised for fast per-organisation timeline queries even when
  -- the event is really about a deal/task/contact underneath it.
  organisation_id uuid references crm.organisations(id) on delete cascade,
  -- Null = system-generated event (e.g. a future webhook), not a person.
  actor_id uuid references crm.team_members(id),
  event_type text not null,
  entity_type text not null check (entity_type in ('organisation', 'contact', 'deal', 'task')),
  entity_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_events_organisation_id_idx on crm.activity_events(organisation_id);
create index activity_events_entity_idx on crm.activity_events(entity_type, entity_id);

-- Auto-logs deal.created and deal.stage_changed — not left to app code
-- to remember every write path (blueprint Section 38: the timeline has
-- to stay right even if a future code path updates `stage` directly).
-- SECURITY DEFINER: this needs to insert into activity_events on behalf
-- of whichever team member's UPDATE fired the trigger, regardless of
-- whether that specific user would otherwise be allowed to INSERT
-- directly — it's the trigger vouching for the event, not the user.
create or replace function crm.log_deal_activity()
returns trigger
language plpgsql
security definer
set search_path = crm, public
as $$
begin
  if tg_op = 'INSERT' then
    insert into crm.activity_events (organisation_id, actor_id, event_type, entity_type, entity_id, metadata)
    values (new.organisation_id, new.created_by, 'deal.created', 'deal', new.id,
      jsonb_build_object('stage', new.stage, 'title', new.title));
  elsif tg_op = 'UPDATE' and new.stage is distinct from old.stage then
    insert into crm.activity_events (organisation_id, actor_id, event_type, entity_type, entity_id, metadata)
    values (new.organisation_id, auth.uid(), 'deal.stage_changed', 'deal', new.id,
      jsonb_build_object('from', old.stage, 'to', new.stage));
  end if;
  return new;
end;
$$;

create trigger deals_log_activity
  after insert or update on crm.deals
  for each row execute function crm.log_deal_activity();

-- ---------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------
create table crm.tasks (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references crm.organisations(id) on delete cascade,
  deal_id uuid references crm.deals(id) on delete cascade,
  assigned_to uuid references crm.team_members(id),
  created_by uuid not null default auth.uid() references crm.team_members(id),
  title text not null,
  description text,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open', 'done')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_deal_id_idx on crm.tasks(deal_id);
create index tasks_assigned_to_idx on crm.tasks(assigned_to);

-- ---------------------------------------------------------------------
-- Row-Level Security
--
-- Full read visibility for any active team member (small team, per
-- explicit instruction). Writes require active team membership AND the
-- attribution column (created_by) must equal the caller's own id — the
-- column default fills it in when omitted, this `with check` is what
-- actually stops one account from writing rows attributed to the other,
-- whether by accident or otherwise. Same "don't trust the client"
-- principle already applied throughout the onboarding portal.
-- ---------------------------------------------------------------------

alter table crm.team_members enable row level security;
alter table crm.organisations enable row level security;
alter table crm.contacts enable row level security;
alter table crm.deal_stages enable row level security;
alter table crm.deals enable row level security;
alter table crm.activity_events enable row level security;
alter table crm.tasks enable row level security;

-- team_members: every active team member can see the (short) team
-- list — useful for assignment dropdowns. No insert/update/delete
-- policy for `authenticated` at all: accounts are provisioned only by
-- the service role.
create policy "team can view team_members"
  on crm.team_members for select
  to authenticated
  using (exists (
    select 1 from crm.team_members m where m.id = auth.uid() and m.is_active
  ));

-- deal_stages: read-only reference data, visible to any active team
-- member. No client-facing write policy — stage list changes are a
-- migration/service-role operation, not a runtime one, for Release 1.
create policy "team can view deal_stages"
  on crm.deal_stages for select
  to authenticated
  using (exists (
    select 1 from crm.team_members m where m.id = auth.uid() and m.is_active
  ));

-- organisations
create policy "team can view organisations"
  on crm.organisations for select
  to authenticated
  using (exists (select 1 from crm.team_members m where m.id = auth.uid() and m.is_active));
create policy "team can insert organisations"
  on crm.organisations for insert
  to authenticated
  with check (
    exists (select 1 from crm.team_members m where m.id = auth.uid() and m.is_active)
    and created_by = auth.uid()
  );
create policy "team can update organisations"
  on crm.organisations for update
  to authenticated
  using (exists (select 1 from crm.team_members m where m.id = auth.uid() and m.is_active))
  with check (exists (select 1 from crm.team_members m where m.id = auth.uid() and m.is_active));

-- contacts
create policy "team can view contacts"
  on crm.contacts for select
  to authenticated
  using (exists (select 1 from crm.team_members m where m.id = auth.uid() and m.is_active));
create policy "team can insert contacts"
  on crm.contacts for insert
  to authenticated
  with check (
    exists (select 1 from crm.team_members m where m.id = auth.uid() and m.is_active)
    and created_by = auth.uid()
  );
create policy "team can update contacts"
  on crm.contacts for update
  to authenticated
  using (exists (select 1 from crm.team_members m where m.id = auth.uid() and m.is_active))
  with check (exists (select 1 from crm.team_members m where m.id = auth.uid() and m.is_active));

-- deals
create policy "team can view deals"
  on crm.deals for select
  to authenticated
  using (exists (select 1 from crm.team_members m where m.id = auth.uid() and m.is_active));
create policy "team can insert deals"
  on crm.deals for insert
  to authenticated
  with check (
    exists (select 1 from crm.team_members m where m.id = auth.uid() and m.is_active)
    and created_by = auth.uid()
  );
create policy "team can update deals"
  on crm.deals for update
  to authenticated
  using (exists (select 1 from crm.team_members m where m.id = auth.uid() and m.is_active))
  with check (exists (select 1 from crm.team_members m where m.id = auth.uid() and m.is_active));

-- activity_events: viewable by any active team member. Direct client
-- insert is allowed only for actor-attributed events (e.g. manually
-- adding a note) — system-derived ones (deal.stage_changed) come from
-- the SECURITY DEFINER trigger above, which bypasses this policy by
-- design. No update/delete policy at all: the timeline is
-- append-only — correcting a mistake means adding a new event, not
-- rewriting history.
create policy "team can view activity_events"
  on crm.activity_events for select
  to authenticated
  using (exists (select 1 from crm.team_members m where m.id = auth.uid() and m.is_active));
create policy "team can insert activity_events"
  on crm.activity_events for insert
  to authenticated
  with check (
    exists (select 1 from crm.team_members m where m.id = auth.uid() and m.is_active)
    and (actor_id is null or actor_id = auth.uid())
  );

-- tasks
create policy "team can view tasks"
  on crm.tasks for select
  to authenticated
  using (exists (select 1 from crm.team_members m where m.id = auth.uid() and m.is_active));
create policy "team can insert tasks"
  on crm.tasks for insert
  to authenticated
  with check (
    exists (select 1 from crm.team_members m where m.id = auth.uid() and m.is_active)
    and created_by = auth.uid()
  );
create policy "team can update tasks"
  on crm.tasks for update
  to authenticated
  using (exists (select 1 from crm.team_members m where m.id = auth.uid() and m.is_active))
  with check (exists (select 1 from crm.team_members m where m.id = auth.uid() and m.is_active));
