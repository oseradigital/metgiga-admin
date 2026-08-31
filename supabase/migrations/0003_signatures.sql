-- Step 3: in-house e-signature (replaces the Documenso integration —
-- 0002_documenso.sql was never applied and has been deleted).
-- Run this once in the Supabase SQL Editor, after 0001_init.sql.

create table if not exists public.signatures (
  id uuid primary key default gen_random_uuid(),
  onboarding_record_id uuid not null references public.onboarding_records(id) on delete cascade,

  -- SHA-256 of the exact agreement text shown at signing time (see
  -- lib/agreement-text.ts). Proves which version was signed even after
  -- the current agreement text changes for future clients — never a
  -- foreign key to any "current" text, since there isn't one.
  document_text_hash text not null,

  typed_name text not null,
  signed_at timestamptz not null default now(),
  ip_address text not null,
  user_agent text
);

alter table public.signatures enable row level security;

-- Same pattern as ad_account_status: select-only for authenticated,
-- scoped through onboarding_records.auth_user_id. No insert/update/delete
-- policy — every write goes through the service role, from
-- lib/onboarding/agreement.ts's signAgreement action.
create policy "client can view own signatures"
  on public.signatures for select
  to authenticated
  using (
    onboarding_record_id in (
      select id from public.onboarding_records where auth_user_id = auth.uid()
    )
  );
