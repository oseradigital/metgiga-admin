-- Client Portal Stage 3: lets a client ask their Metgiga team for
-- something directly in the portal (the "Support" nav destination),
-- replacing Home's plain mailto: link. This is the first
-- client-WRITABLE table in either app — every other client-facing
-- table so far (activity_events, client_documents) is team-write,
-- client-read-only.
--
-- Deliberately NOT auto-creating a crm.tasks row per the original
-- product plan's "optionally" — tasks.created_by is `not null
-- references crm.team_members(id)`, so a client-submitted task would
-- need that constraint loosened for one call site. A dedicated
-- Requests surface (global /requests list + an organisation tab,
-- mirroring Tasks' own shape) keeps the richer subject/message/
-- status/response structure intact instead of flattening it into a
-- task title string, and needs no schema change to an existing table.

create table crm.client_requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references crm.organisations(id) on delete cascade,
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  response text,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_requests_organisation_id_idx on crm.client_requests(organisation_id);

alter table crm.client_requests enable row level security;

-- Team: full read, and update only (status/response) — no team insert
-- (these come from clients) and no delete (a resolved request is kept
-- as history, same as every other event/document trail in this app).
create policy "team can view client_requests"
  on crm.client_requests for select
  to authenticated
  using (crm.is_active_team_member());

create policy "team can update client_requests"
  on crm.client_requests for update
  to authenticated
  using (crm.is_active_team_member())
  with check (crm.is_active_team_member());

-- Client: can create and read their own organisation's requests, same
-- bridge every client-facing table uses. No client update/delete —
-- once submitted, it's the team's queue to manage; a request made in
-- error is just superseded by a new one, not edited in place.
create policy "client can create their own organisation's requests"
  on crm.client_requests for insert
  to authenticated
  with check (
    organisation_id in (
      select organisation_id from public.onboarding_records
      where auth_user_id = auth.uid() and organisation_id is not null
    )
  );

create policy "client can view own organisation's requests"
  on crm.client_requests for select
  to authenticated
  using (
    organisation_id in (
      select organisation_id from public.onboarding_records
      where auth_user_id = auth.uid() and organisation_id is not null
    )
  );

-- ---------------------------------------------------------------------
-- Team-side activity log entry on submit (not client-visible — the
-- client already sees the request directly on /support, so a second
-- "you submitted a request" line on their own Home would be pure
-- redundancy, unlike document.uploaded which surfaces something new).
-- A trigger, not a client-side insert into activity_events: clients
-- have no insert policy on that table at all, matching how
-- onboarding.completed is already system-logged rather than granting
-- broader write access for one event type.
-- ---------------------------------------------------------------------
create or replace function crm.log_client_request_submitted()
returns trigger
language plpgsql
security definer
set search_path = crm, public
as $$
begin
  insert into crm.activity_events (organisation_id, actor_id, event_type, entity_type, entity_id, metadata)
  values (new.organisation_id, null, 'client_request.submitted', 'organisation', new.organisation_id,
    jsonb_build_object('subject', new.subject));
  return new;
end;
$$;

create trigger client_requests_log_activity
  after insert on crm.client_requests
  for each row execute function crm.log_client_request_submitted();
