-- Rename the first onboarding stage's display name: "Your clinic" -> "Your business".
-- The portal isn't clinic-specific; this is a user-facing copy change
-- (lib/onboarding/stages.ts, the step <h2>, the Final Review section,
-- metgiga-admin's Onboarding panel). It needs a migration only because
-- the name is also materialised in the CHECK constraint on
-- current_onboarding_step (added in 0008) — lib/onboarding/actions.ts
-- now writes "Your business" for the clinic step, which the old
-- constraint rejects (23514).
--
-- No data backfill: verified against prod on 2026-09-02 that no row
-- currently stores current_onboarding_step = 'Your clinic' (the values
-- present were 'Business & team' and 'Content & brand'). If any old row
-- does turn up with it, it's a stale "where were they last" pointer with
-- no downstream meaning — safe to leave or update by hand.
--
-- Portal + admin share one Supabase project, so run this once. Mirrored
-- to metgiga-admin/supabase/migrations/0017_rename_first_stage.sql.

alter table public.onboarding_records
  drop constraint if exists onboarding_records_current_onboarding_step_check;

alter table public.onboarding_records
  add constraint onboarding_records_current_onboarding_step_check
  check (
    current_onboarding_step is null
    or current_onboarding_step in (
      'Your business', 'Business & team', 'Marketing access',
      'Content & brand', 'Agreement', 'Final review'
    )
  );
