-- Decouple "onboarding is finished / this token is spent" from
-- auth_user_id into an explicit column.
--
-- Until now auth_user_id did double duty: "a real account exists" AND
-- "onboarding is complete". They're set together (lib/onboarding/invite.ts,
-- when the agreement is signed) so it worked, but it means the two can
-- never diverge — e.g. if account creation ever moves earlier in the
-- flow. onboarding_completed_at is now the completion signal;
-- auth_user_id stays purely "an auth.users row is linked".
--
-- This migration is a pure refactor: invite.ts now writes both columns
-- in the same update, and the backfill below gives every already-complete
-- record a timestamp, so getOnboardingRecordByToken / metgiga-admin's
-- isOnboardingComplete / the crm.log_onboarding_completed trigger behave
-- exactly as before.
--
-- Portal + admin share one Supabase project — run once. Mirror of
-- metgiga-portal/supabase/migrations/0012_onboarding_completed_at.sql.

alter table public.onboarding_records
  add column if not exists onboarding_completed_at timestamptz;

-- Backfill: 3 rows on prod as of 2026-09-02 (auth_user_id set, none
-- org-linked). updated_at is an accurate stand-in for "when" — the
-- portal makes no further writes to a record after completion.
update public.onboarding_records
  set onboarding_completed_at = updated_at
  where auth_user_id is not null
    and onboarding_completed_at is null;

-- The CRM timeline event: fire it on the onboarding_completed_at
-- transition instead of the auth_user_id one. Everything else about the
-- function is unchanged — same SECURITY DEFINER reasoning, same
-- NOT EXISTS idempotency backstop, still only fires once the record is
-- also org-linked. (In the current flow both columns still change in the
-- same update, so the firing moment is identical.)
create or replace function crm.log_onboarding_completed()
returns trigger
language plpgsql
security definer
set search_path = crm, public
as $$
begin
  if new.organisation_id is not null and new.onboarding_completed_at is not null
     and (old.organisation_id is distinct from new.organisation_id
          or old.onboarding_completed_at is distinct from new.onboarding_completed_at)
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
