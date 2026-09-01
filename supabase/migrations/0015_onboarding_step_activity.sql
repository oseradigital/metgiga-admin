-- Follow-up to 0014: real step progress and stalled-onboarding
-- detection for Admin's Onboarding tab, instead of the mechanical
-- "N of M fields completed" count. Confirmed scope with the founder
-- before building: stall threshold 3 days, contained to the Onboarding
-- tab only (not Overview's Needs attention yet — that section's own
-- 14-day threshold hasn't been proven against real usage either, and
-- stacking a second unproven heuristic there risks making Overview
-- noisy rather than trustworthy; promote this once it's shown it
-- correctly flags real stalls).
--
-- Mirrored verbatim into
-- metgiga-portal/supabase/migrations/0008_onboarding_step_activity.sql.

-- current_onboarding_step stores the stage's own display name (matching
-- metgiga-portal/lib/onboarding/stages.ts's ONBOARDING_STAGES exactly),
-- not a re-derived index — an index would silently go stale if a stage
-- is ever added, removed, or reordered there. All 6 stage names are
-- allowed by the constraint for forward-compatibility, but this round
-- only ever writes the first 4: metgiga-portal's lib/onboarding/actions.ts
-- is the only file touched this pass (confirmed scope), and Agreement /
-- Final review are handled by different code
-- (lib/onboarding/agreement.ts and the read-only final-review screen)
-- that isn't part of this change.
--
-- Reflects whichever stage was MOST RECENTLY saved, not "furthest stage
-- ever reached" — if a client goes back and edits "Your clinic" after
-- already reaching "Content & brand", this deliberately moves backward
-- too. That's the honest answer to "where are they right now", which is
-- what the column name says it tracks.
alter table public.onboarding_records
  add column if not exists current_onboarding_step text
    check (current_onboarding_step is null or current_onboarding_step in (
      'Your clinic', 'Business & team', 'Marketing access', 'Content & brand', 'Agreement', 'Final review'
    ));

-- Deliberately distinct from updated_at: updated_at is also bumped by
-- admin-side actions (crm.link_onboarding_record_to_organisation sets
-- it when an admin links a record), so it no longer cleanly means "the
-- client was last active here". last_onboarding_activity_at is set
-- ONLY by the client-facing save actions in actions.ts, never by
-- anything admin-initiated, so it stays a clean signal for "has the
-- client gone quiet".
alter table public.onboarding_records
  add column if not exists last_onboarding_activity_at timestamptz;

-- No RLS or grant changes needed: every save* action in actions.ts uses
-- createAdminClient() (service role), which bypasses RLS and column
-- grants entirely — these two columns are simply never added to the
-- client's own `grant update (...)` list from migration 0001, so a
-- client's own authenticated session (post-auth) cannot write to them
-- directly via a raw REST call, same protection already relied on for
-- agreement_status/payment_confirmed/kickoff_booked.
