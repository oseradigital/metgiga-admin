-- Fixes a real gap found while testing the login flow: RLS policies on
-- crm.* (0007) control row-level visibility, but the `authenticated`
-- role never got base schema/table-level privileges to reach that check
-- in the first place — `public` gets those automatically from Supabase's
-- own defaults, a newly created schema doesn't. Without this,
-- `.schema("crm").from(...)` fails with "permission denied for schema
-- crm" (42501) before RLS is even evaluated.
--
-- `anon` deliberately gets nothing here — every crm.* policy is scoped
-- `to authenticated`, and this app has no pre-auth/token flow (unlike
-- the client portal's onboarding links), so an anonymous request should
-- never reach anything in this schema.

grant usage on schema crm to authenticated;
grant select, insert, update, delete on all tables in schema crm to authenticated;

-- So a future migration that adds a new crm.* table doesn't silently
-- repeat this same gap.
alter default privileges in schema crm
  grant select, insert, update, delete on tables to authenticated;
