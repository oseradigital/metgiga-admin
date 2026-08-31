-- Stage 6: the Marketing Access screen saves all connection statuses in
-- one call (lib/onboarding/actions.ts's saveAdAccountAccess), upserting
-- keyed on (onboarding_record_id, platform) so re-visiting the step
-- updates existing rows instead of accumulating duplicates. Needs a
-- unique constraint to upsert against — 0001_init.sql never added one
-- since nothing wrote to this table yet.
alter table public.ad_account_status
  add constraint ad_account_status_record_platform_unique
  unique (onboarding_record_id, platform);
