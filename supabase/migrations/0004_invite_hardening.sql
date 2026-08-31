-- Step 4: invitation token hardening (expiry, revocation).
-- Run via `supabase db push`.
--
-- "Single-use after completion" is deliberately NOT a new column here —
-- auth_user_id already means exactly that (see lib/onboarding/invite.ts:
-- it's set the moment agreement_status='signed' AND payment_confirmed
-- are both true, i.e. onboarding is genuinely complete and a real login
-- exists). getOnboardingRecordByToken now treats a set auth_user_id as
-- "this token's job is done" without needing to track that twice.

alter table public.onboarding_records
  add column if not exists expires_at timestamptz not null default (now() + interval '30 days'),
  add column if not exists revoked_at timestamptz;
