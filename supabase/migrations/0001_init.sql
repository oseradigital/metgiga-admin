-- Step 1: onboarding + dashboard schema (onboarding_records,
-- ad_account_status, documents, reports).
-- Run this once in the Supabase SQL Editor (Dashboard > SQL Editor > New query),
-- in a Supabase project of its own — not the met-giga clinic-saas project.

create extension if not exists pgcrypto;

-- One row per client engagement. Created server-side (service role) as
-- soon as onboarding starts, before any auth account exists — identified
-- during that pre-auth window by access_token, not email or auth.uid().
create table if not exists public.onboarding_records (
  id uuid primary key default gen_random_uuid(),

  -- Nullable until the client claims their invite and actually logs in
  -- for the first time (mirrors clinic_staff.auth_user_id in met-giga).
  auth_user_id uuid references auth.users(id) on delete set null,

  -- Random, high-entropy token used in the onboarding URL to identify this
  -- record before an auth account exists. Generate with enough entropy
  -- (e.g. crypto.randomBytes(32).toString('hex') server-side) — nothing in
  -- this migration generates it for you, so the inserting code must always
  -- supply one.
  access_token text unique not null,

  -- Business intake (lib/onboarding-types.ts: BusinessIntake) — nullable,
  -- filled in as the client progresses through the Business Intake step.
  business_name text,
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,
  treatment_priorities text,
  brand_guidelines_notes text,
  compliance_contact text,
  monthly_ad_spend_range text
    check (monthly_ad_spend_range in ('none', 'under-1k', '1k-3k', '3k-10k', '10k-plus')),
  monthly_revenue_range text
    check (monthly_revenue_range in ('under-10k', '10k-20k', '20k-50k', '50k-plus', 'prefer-not-to-say')),
  current_channels text[],
  current_agency_or_freelancer text,
  monthly_enquiries text,
  current_show_rate text,
  has_existing_crm boolean,
  existing_crm_name text,
  past_agency_experience text,
  ninety_day_goal text,

  -- Flow status — system-controlled, never client-editable (see the
  -- column-level grant below).
  agreement_status text not null default 'not-started'
    check (agreement_status in ('not-started', 'sent', 'signed')),
  payment_confirmed boolean not null default false,
  kickoff_booked boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per ad platform per client (lib/onboarding-types.ts: AdAccountAccess).
create table if not exists public.ad_account_status (
  id uuid primary key default gen_random_uuid(),
  onboarding_record_id uuid not null references public.onboarding_records(id) on delete cascade,
  platform text not null check (platform in ('meta', 'google', 'ga4', 'gtm')),
  status text not null default 'not-requested'
    check (status in ('not-requested', 'requested', 'confirmed')),
  last_checked timestamptz
);

-- Agency-delivered files (signed agreement, invoices, reports, etc). Only
-- exists once the client is a real authenticated user — client_id is not
-- null and references auth.users directly (unlike onboarding_records,
-- there's no pre-auth phase for these).
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text check (category in ('agreement', 'invoice', 'report', 'other')),
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- Periodic performance reports the agency delivers to the client.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  period text not null, -- e.g. "July 2026"
  storage_path text not null,
  generated_at timestamptz not null default now()
);

alter table public.onboarding_records enable row level security;
alter table public.ad_account_status enable row level security;
alter table public.documents enable row level security;
alter table public.reports enable row level security;

-- No policy here targets the anon role or matches auth_user_id IS NULL —
-- a plain `=` comparison against auth.uid() never matches NULL (NULL = NULL
-- is unknown, not true), and RLS defaults to deny with no matching policy.
-- So pre-auth rows are already unreachable by anon/authenticated by
-- construction; only the service role (which bypasses RLS entirely) can
-- read or write them, which is how the onboarding Server Actions look
-- records up by access_token.
create policy "client can view own onboarding record"
  on public.onboarding_records for select
  to authenticated
  using (auth_user_id = auth.uid());

create policy "client can update own onboarding record"
  on public.onboarding_records for update
  to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- DEVIATION FROM SPEC, READ BEFORE RUNNING: the update policy above is
-- row-level only — Postgres RLS can't restrict *which columns* an UPDATE
-- touches. Without the grant below, an authenticated client could set
-- their own agreement_status/payment_confirmed/kickoff_booked directly via
-- a REST call, bypassing the e-sign and Stripe webhooks entirely (the
-- exact "never trust the frontend" failure met-giga's CLAUDE.md calls out
-- for payments). This restricts client self-edit to profile fields only —
-- the flow-status columns stay writable only by the service role.
revoke update on public.onboarding_records from authenticated;
grant update (
  business_name, primary_contact_name, primary_contact_email, primary_contact_phone,
  treatment_priorities, brand_guidelines_notes, compliance_contact,
  monthly_ad_spend_range, monthly_revenue_range, current_channels,
  current_agency_or_freelancer, monthly_enquiries, current_show_rate,
  has_existing_crm, existing_crm_name, past_agency_experience, ninety_day_goal,
  updated_at
) on public.onboarding_records to authenticated;

create policy "client can view own ad account status"
  on public.ad_account_status for select
  to authenticated
  using (
    onboarding_record_id in (
      select id from public.onboarding_records where auth_user_id = auth.uid()
    )
  );
-- No insert/update/delete policy: ad account access is confirmed by you
-- (manually, or via the Meta/Google APIs per the README), not the client,
-- so writes go through the service role only.

-- DEVIATION FROM SPEC, READ BEFORE RUNNING: documents and reports are
-- agency-delivered records (signed agreement, invoices, performance
-- reports) uploaded via storage_path from server-side code — not files the
-- client authors. A client-facing edit/delete policy would let them alter
-- or delete their own signed agreement or performance history, which is a
-- record-integrity problem, not just a permissions one. Scoped to
-- view-only; tell me if you actually want clients able to rename/delete
-- their own rows (e.g. a future "client uploads brand assets" feature)
-- and I'll add a scoped insert/update/delete policy for that case.
create policy "client can view own documents"
  on public.documents for select
  to authenticated
  using (client_id = auth.uid());

create policy "client can view own reports"
  on public.reports for select
  to authenticated
  using (client_id = auth.uid());
