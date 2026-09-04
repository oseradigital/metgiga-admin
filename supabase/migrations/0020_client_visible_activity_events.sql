-- Client Portal Stage 1 (Home V1): lets a client read a narrow,
-- allowlisted slice of their own organisation's activity_events, for
-- the "recent activity" section.
--
-- activity_events is otherwise entirely internal — "team can view
-- activity_events" (0007) already lets any active team member see
-- everything, including deal.stage_changed, note.added, and other
-- CRM/sales data that must never reach a client (see docs/
-- CLIENT_PORTAL_PLAN.md's "never expose internal notes/deal data"
-- rule). So this is deliberately NOT "client can view own org's
-- events" — it's scoped by an explicit event_type allowlist, starting
-- with exactly one type. Extend the list as later stages add more
-- client-safe event types (content.approved, report.published, etc.);
-- never widen this to "all events for the org."
--
-- Postgres RLS policies for the same command are OR'd together, so this
-- is purely additive — it can't loosen what team members already see,
-- and it can't be satisfied by a team member's own session unless they
-- also happen to be the client (they aren't: crm.team_members and
-- portal auth_user_id are disjoint identities).
create policy "client can view own organisation's client-visible activity"
  on crm.activity_events
  for select
  to authenticated
  using (
    event_type in ('onboarding.completed')
    and organisation_id in (
      select organisation_id from public.onboarding_records
      where auth_user_id = auth.uid() and organisation_id is not null
    )
  );
