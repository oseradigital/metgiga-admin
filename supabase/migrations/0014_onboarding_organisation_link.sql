-- Release 1 final alignment: link public.onboarding_records (Client
-- Portal, pre-auth intake) to crm.organisations (Admin), so onboarding
-- data is visible from an organisation's record instead of living in a
-- second, disconnected system.
--
-- Same physical Supabase project as the Client Portal (confirmed:
-- NEXT_PUBLIC_SUPABASE_URL is wriwcjkkqxmkkyiahvml in both repos) — this
-- is exactly the cross-schema linkage the shared-project decision at the
-- start of Release 1 was made to allow. This file is mirrored verbatim
-- into metgiga-portal/supabase/migrations/0007_onboarding_organisation_link.sql
-- so both repos' local migration history stays truthful to the one real
-- database, matching the existing 0001-0006 mirrored history.

-- Nullable, not unique: not every onboarding_records row will have a
-- matching organisation (e.g. very old test rows), and there's no
-- guarantee yet that a given organisation has exactly one onboarding
-- record. Linking is a deliberate admin action (below), not inferred.
alter table public.onboarding_records
  add column if not exists organisation_id uuid references crm.organisations(id) on delete set null;

create index if not exists onboarding_records_organisation_id_idx
  on public.onboarding_records(organisation_id);

-- Admin (any active crm.team_members row) can VIEW onboarding data for
-- linked records — read-only. This is additive: it doesn't touch the
-- existing "client can view own onboarding record" policy at all, so
-- client-side visibility is unchanged. Reuses crm.is_active_team_member()
-- (the same SECURITY DEFINER helper from migration 0009) rather than an
-- inline subquery, for the same recursion-safety reason it was
-- introduced for originally.
create policy "team can view onboarding records"
  on public.onboarding_records for select
  to authenticated
  using (crm.is_active_team_member());

-- Linking is intentionally NOT done via a raw column grant + RLS update
-- policy: granting UPDATE (organisation_id) to `authenticated` broadly
-- would also technically hand that grant to clients (Postgres
-- column-level grants aren't RLS-scoped to team members), who could then
-- point their own record at an arbitrary organisation_id via a raw REST
-- call even though they can't read anyone else's data through it. A
-- SECURITY DEFINER RPC avoids ever widening the table grant: only the
-- function's own internal check decides who may write, independent of
-- PostgREST column grants.
create or replace function public.link_onboarding_record_to_organisation(
  onboarding_id uuid,
  org_id uuid
) returns void
language plpgsql
security definer
set search_path = public, crm
as $$
begin
  if not crm.is_active_team_member() then
    raise exception 'Not authorized';
  end if;

  update public.onboarding_records
  set organisation_id = org_id, updated_at = now()
  where id = onboarding_id;
end;
$$;

revoke all on function public.link_onboarding_record_to_organisation from public;
grant execute on function public.link_onboarding_record_to_organisation to authenticated;

-- Auto-logs "onboarding.completed" on the linked organisation's
-- timeline, exactly once, at whichever moment happens later: the record
-- becoming complete (auth_user_id set, mirrors the same signal
-- getOnboardingRecordByToken already uses in the portal) or being
-- linked to an organisation while already complete. Same
-- SECURITY DEFINER reasoning as crm.log_deal_activity — this needs to
-- write into crm.activity_events regardless of which role's UPDATE
-- fired it (very often a client's own session, which has no INSERT
-- grant on crm.activity_events and isn't a crm.team_members row, so
-- actor_id must be null here, not auth.uid()). The NOT EXISTS guard is
-- the real idempotency backstop — the two-condition transition check
-- alone would still be safe under normal use, but this makes it correct
-- even under a retried/out-of-order update.
create or replace function crm.log_onboarding_completed()
returns trigger
language plpgsql
security definer
set search_path = crm, public
as $$
begin
  if new.organisation_id is not null and new.auth_user_id is not null
     and (old.organisation_id is distinct from new.organisation_id
          or old.auth_user_id is distinct from new.auth_user_id)
     and not exists (
       select 1 from crm.activity_events
       where organisation_id = new.organisation_id
         and event_type = 'onboarding.completed'
     )
  then
    insert into crm.activity_events (organisation_id, actor_id, event_type, entity_type, entity_id, metadata)
    values (new.organisation_id, null, 'onboarding.completed', 'organisation', new.organisation_id,
      jsonb_build_object('onboarding_record_id', new.id));
  end if;
  return new;
end;
$$;

create trigger onboarding_records_log_completed
  after update on public.onboarding_records
  for each row execute function crm.log_onboarding_completed();

-- "Organisation created" (final alignment spec item 19) — the one entity
-- in the CRM that had no creation event at all; deals already get this
-- via crm.log_deal_activity.
create or replace function crm.log_organisation_created()
returns trigger
language plpgsql
security definer
set search_path = crm, public
as $$
begin
  insert into crm.activity_events (organisation_id, actor_id, event_type, entity_type, entity_id, metadata)
  values (new.id, new.created_by, 'organisation.created', 'organisation', new.id,
    jsonb_build_object('name', new.name));
  return new;
end;
$$;

create trigger organisations_log_created
  after insert on crm.organisations
  for each row execute function crm.log_organisation_created();

-- Deal-stage architecture (final alignment spec item 17): marks which
-- stages are expected to become system-derived once Proposals
-- automation (e-sign, Stripe webhooks, view tracking) ships in a later
-- release, vs. the ones that stay a human call even then. Metadata only
-- for now — nothing in this migration blocks a manual move into a
-- system-managed stage, since no automation exists yet to do it any
-- other way; blocking it now would just make the current pipeline
-- unusable for those stages. This is the foundation Release 2+ builds
-- enforcement on top of (e.g. once a real e-sign webhook exists,
-- restrict agreement_signed to that trigger, not manual selection),
-- flagged here rather than silently deferred.
alter table crm.deal_stages
  add column if not exists is_system_managed boolean not null default false;

update crm.deal_stages set is_system_managed = true
  where id in ('proposal_sent', 'proposal_viewed', 'proposal_accepted',
               'agreement_signed', 'payment_pending', 'payment_completed', 'deal_won');
