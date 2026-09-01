-- Real email verification for the Business & team step's contact email
-- — MX checking (migration 0015... no, that was step tracking; the MX
-- check itself shipped without its own migration, no schema change
-- needed) confirms a domain exists, not that a specific mailbox does.
-- randomfakename@gmail.com passes MX checking and always will —
-- proving the client can actually receive mail at the address is the
-- only real answer, hence a code they have to receive and enter.
--
-- Mirrored verbatim into
-- metgiga-portal/supabase/migrations/0009_email_verification.sql.

-- One row per onboarding record (not one row per code sent) — this
-- tracks the CURRENT verification attempt, not a history of every one.
-- Requesting a new code (first send or resend) overwrites this row in
-- place via upsert on the unique onboarding_record_id.
create table public.email_verifications (
  id uuid primary key default gen_random_uuid(),
  onboarding_record_id uuid not null references public.onboarding_records(id) on delete cascade,
  -- The email this code was sent to — checked against
  -- onboarding_records.primary_contact_email on every verify attempt,
  -- so a code sent to an email the client has since edited away from
  -- can never verify the NEW value (requirement: editing after
  -- verifying requires re-verification).
  email text not null,
  -- Never the raw 6-digit code — a DB read (backup, replica lag,
  -- anything) should never hand out a live, usable code.
  code_hash text not null,
  expires_at timestamptz not null,
  -- Capped in application code (5) — once reached, the code is dead
  -- regardless of expires_at, and the client is told to request a new
  -- one rather than keep guessing against the same hash.
  attempts int not null default 0,
  verified_at timestamptz,
  -- Drives the 60-second resend rate limit, enforced server-side in
  -- lib/onboarding/email-verification.ts — this column existing isn't
  -- the rate limit itself, the action's own check against it is.
  last_sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (onboarding_record_id)
);

-- Denormalized onto the parent record on purpose (not just derived from
-- this table) — explicitly requested so Admin can see it directly
-- without joining, and so it's a real, queryable fact about the record
-- rather than something reconstructed from verification bookkeeping.
-- Kept in sync by lib/onboarding/actions.ts's saveBusinessTeam, which
-- is also the only thing authorized to set it true (see that file — it
-- re-checks this table's own verified_at + email match before ever
-- writing true, a raw fetch can't just set it directly since it isn't
-- in the client's own update-grant column list, same protection
-- pattern as agreement_status).
alter table public.onboarding_records
  add column if not exists contact_email_verified boolean not null default false;

alter table public.email_verifications enable row level security;
-- No policies at all, deliberately — this table is pre-auth
-- bookkeeping containing code hashes and attempt counts, exactly like
-- onboarding_records itself before an auth account exists (see 0001's
-- comment on that). Only the service role (used by every action in
-- lib/onboarding/email-verification.ts) can read or write it; RLS
-- default-denies anon and authenticated with nothing else needed. Admin
-- visibility is via contact_email_verified on onboarding_records
-- itself, not this table.
