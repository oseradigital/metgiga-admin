-- Real gap found while building the E2E suite, with a real consequence:
-- 0008 granted `authenticated` access to the crm schema, but never
-- granted `service_role` anything — service_role bypasses RLS, but that
-- doesn't exempt it from the same base schema/table GRANT requirement
-- every other role needs. `public` gets this automatically from
-- Supabase's own project bootstrapping; a schema created by migration
-- does not.
--
-- Consequence: every service-role write against crm.* this build has
-- made (test setup AND cleanup deletes) may have silently failed —
-- "may" because several of those calls' results were logged as
-- successful without actually checking the returned `error`. This
-- migration is step one of confirming and fixing that; the actual
-- database audit for orphaned test rows happens right after, separately
-- from this file.
grant usage on schema crm to service_role;
grant all on all tables in schema crm to service_role;
grant all on all sequences in schema crm to service_role;
alter default privileges in schema crm grant all on tables to service_role;
alter default privileges in schema crm grant all on sequences to service_role;
