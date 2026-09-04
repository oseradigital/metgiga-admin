-- Client Portal Stage 2, increment 2: lets the team upload files
-- (invoices, deliverables, contracts beyond the existing signed
-- agreement) that show up on a client's own /documents page. This is
-- the first use of Supabase Storage in either app — deliberately held
-- back from increment 1 for explicit review before building; see
-- metgiga-portal/docs/CLIENT_PORTAL_PLAN.md.
--
-- Clients never get direct Storage RLS access at all. The storage.objects
-- policies below are team-only; a client's copy is served exclusively
-- through a signed URL the portal's own API route generates server-side
-- after confirming — via the client's own RLS-scoped read of
-- crm.client_documents below — that they're allowed to see that
-- specific row. Simpler and safer than writing storage.objects RLS that
-- has to parse organisation_id back out of a file path.

create table crm.client_documents (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references crm.organisations(id) on delete cascade,
  created_by uuid not null default auth.uid() references crm.team_members(id),
  title text not null,
  storage_path text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  created_at timestamptz not null default now()
);

create index client_documents_organisation_id_idx on crm.client_documents(organisation_id);

alter table crm.client_documents enable row level security;

create policy "team can view client_documents"
  on crm.client_documents for select
  to authenticated
  using (crm.is_active_team_member());

create policy "team can insert client_documents"
  on crm.client_documents for insert
  to authenticated
  with check (crm.is_active_team_member() and created_by = auth.uid());

create policy "team can delete client_documents"
  on crm.client_documents for delete
  to authenticated
  using (crm.is_active_team_member());

-- No update policy — a wrong upload is deleted and re-added, not
-- edited in place. Nothing here needs an edit history.

-- Client visibility: the same bridge every client-facing table uses.
create policy "client can view own organisation's documents"
  on crm.client_documents
  for select
  to authenticated
  using (
    organisation_id in (
      select organisation_id from public.onboarding_records
      where auth_user_id = auth.uid() and organisation_id is not null
    )
  );

-- ---------------------------------------------------------------------
-- Storage bucket + policies — team-only, per the note above.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

create policy "team can upload client documents"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'client-documents' and crm.is_active_team_member());

create policy "team can view client documents in storage"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'client-documents' and crm.is_active_team_member());

create policy "team can delete client documents in storage"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'client-documents' and crm.is_active_team_member());

-- ---------------------------------------------------------------------
-- A client-visible activity event on upload, so it surfaces in the
-- client's Recent activity on Home — extending Stage 1's already-built
-- allowlisted feed, not a second notification system. Logged against
-- the organisation itself (entity_type='organisation'), the same shape
-- 'onboarding.completed' already uses, rather than adding 'document' to
-- activity_events' entity_type check constraint for one call site.
-- ---------------------------------------------------------------------
drop policy "client can view own organisation's client-visible activity" on crm.activity_events;
create policy "client can view own organisation's client-visible activity"
  on crm.activity_events
  for select
  to authenticated
  using (
    event_type in ('onboarding.completed', 'document.uploaded')
    and organisation_id in (
      select organisation_id from public.onboarding_records
      where auth_user_id = auth.uid() and organisation_id is not null
    )
  );
