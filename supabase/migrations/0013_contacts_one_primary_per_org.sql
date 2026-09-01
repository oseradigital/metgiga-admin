-- Primary-contact integrity (item 9 of the UX refinement pass).
--
-- The application already clears any existing primary before setting a
-- new one (createContact / setPrimaryContact in lib/crm/actions.ts both
-- do this as two sequential statements) -- that's what gives the smooth
-- "marking John primary automatically un-primaries Sarah" UX with no
-- error. But two sequential statements aren't atomic against a
-- concurrent request doing the same thing, so app-level discipline
-- alone doesn't GUARANTEE the invariant, only makes it the common case.
--
-- This partial unique index is the actual guarantee: Postgres will
-- refuse to let two contacts in the same organisation both have
-- is_primary = true, full stop, regardless of which code path (a race,
-- a bug, a future direct SQL edit) tried to cause it. Partial (WHERE
-- is_primary) rather than a plain unique index on (organisation_id,
-- is_primary), so any number of non-primary contacts per org is still
-- fine -- only "two primaries at once" is blocked.
create unique index if not exists contacts_one_primary_per_org
  on crm.contacts (organisation_id)
  where is_primary;
