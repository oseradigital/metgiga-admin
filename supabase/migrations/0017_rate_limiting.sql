-- Rolling-window rate limiting for the email-verification gate:
--   * a hard ceiling on OTP sends per onboarding record (the backstop the
--     60s cooldown alone doesn't give — see lib/onboarding/email-verification.ts)
--   * abuse protection for the unauthenticated GET /onboarding record
--     creation path, keyed by an HMAC of the client IP
--     (see lib/onboarding/actions.ts createOnboardingRecord + lib/rate-limit.ts)
--
-- One generic store + one atomic check-and-increment function, rather
-- than bespoke counters on each table. The application code is written
-- to run fine BEFORE this migration is applied (it probes for the
-- function and falls back to cooldown-only / no-throttle), so deploy
-- order doesn't matter.
--
-- Housekeeping mirror, not a new change: this was already applied to the
-- shared prod database back when it shipped (portal confirmed RATE_LIMIT_SALT
-- set, smoke-tested, live) — admin's local migration history was just
-- missing the file, leaving the numbering gap at 0017. Mirrored verbatim
-- from metgiga-portal/supabase/migrations/0010_rate_limiting.sql so both
-- repos' history matches the one real database. Nothing here needs
-- re-running.

create table if not exists public.rate_limits (
  -- e.g. "otp_send:<onboarding_record_id>" or "onboard_create:<ip_hmac>"
  bucket text primary key,
  hits int not null default 0,
  window_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rate_limits enable row level security;
-- No policies, deliberately — pre-auth anti-abuse bookkeeping, exactly
-- like email_verifications. Only the service role (used by the Server
-- Actions) touches it; RLS default-denies anon and authenticated. The
-- rows hold no PII and no cross-tenant data — just an opaque bucket key
-- and an integer counter.

comment on table public.rate_limits is
  'Rolling-window counters for pre-auth rate limiting (OTP sends, anonymous onboarding creation). Service-role only; contains no PII.';

-- Atomic check-and-increment. Returns true when the caller is within the
-- limit (the hit is recorded), false when the window is already full.
--
-- SECURITY DEFINER hardening (audited):
--   * search_path is pinned to '' and EVERY referenced object is
--     schema-qualified — pg_catalog for built-ins, public for the table.
--     Nothing resolves against a caller-controlled, search_path- or
--     pg_temp-shadowed object. `set search_path = public` alone is NOT
--     sufficient and is deliberately not used.
--   * the only object it touches is public.rate_limits. It takes no
--     table/column/identifier as input (only text/int values), so it
--     cannot be redirected at other data even in principle.
--   * a single INSERT ... ON CONFLICT DO UPDATE — atomic, no read-modify-
--     write race, no advisory locks needed.
--   * EXECUTE is revoked from PUBLIC, anon and authenticated, and granted
--     only to service_role (the role the portal's admin client,
--     SUPABASE_SERVICE_ROLE_KEY, runs as via PostgREST). No anon/auth/
--     public path can invoke it.
create or replace function public.rate_limit_hit(
  p_bucket text,
  p_max int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.now();
  v_window interval := pg_catalog.make_interval(secs => p_window_seconds);
  v_hits int;
begin
  insert into public.rate_limits as rl (bucket, hits, window_started_at, updated_at)
  values (p_bucket, 1, v_now, v_now)
  on conflict (bucket) do update set
    hits = case when v_now - rl.window_started_at >= v_window then 1 else rl.hits + 1 end,
    window_started_at = case when v_now - rl.window_started_at >= v_window then v_now else rl.window_started_at end,
    updated_at = v_now
  returning hits into v_hits;

  -- Allowed while at or under the cap. A blocked request still bumped the
  -- counter above the cap; that only ever extends the block, and the
  -- window still resets purely by elapsed time, so an honest client is
  -- never stuck.
  return v_hits <= p_max;
end;
$$;

revoke all on function public.rate_limit_hit(text, int, int) from public;
revoke all on function public.rate_limit_hit(text, int, int) from anon;
revoke all on function public.rate_limit_hit(text, int, int) from authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

-- Housekeeping index for a future cleanup job (delete rows whose window
-- is long past). Not read by the function itself.
create index if not exists rate_limits_updated_at_idx on public.rate_limits (updated_at);
