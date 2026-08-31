-- Fixes a real bug found while testing login: every crm.* policy gates
-- on "is the caller an active team member", checked inline as
-- `exists (select 1 from crm.team_members m where m.id = auth.uid() and
-- m.is_active)`. On crm.team_members ITSELF, that inline subquery
-- queries the very table its policy protects — Postgres re-evaluates the
-- SAME policy to run that subquery, which runs the subquery again,
-- forever: "infinite recursion detected in policy for relation
-- team_members" (42P17). This broke every crm.* table's access check,
-- not just team_members' own, since they all share this pattern.
--
-- Standard fix: move the check into a SECURITY DEFINER function. Owned
-- by the migration role (which owns these tables and isn't subject to
-- their RLS, since FORCE ROW LEVEL SECURITY was never set), the
-- function's internal query against crm.team_members bypasses RLS
-- entirely — no policy re-evaluation, no recursion. `stable` because the
-- answer can't change within one statement.
create or replace function crm.is_active_team_member()
returns boolean
language sql
security definer
set search_path = crm, pg_temp
stable
as $$
  select exists (
    select 1 from crm.team_members where id = auth.uid() and is_active
  );
$$;

revoke all on function crm.is_active_team_member() from public;
grant execute on function crm.is_active_team_member() to authenticated;

-- Replace every policy that used the recursive inline check.
drop policy "team can view team_members" on crm.team_members;
create policy "team can view team_members"
  on crm.team_members for select
  to authenticated
  using (crm.is_active_team_member());

drop policy "team can view deal_stages" on crm.deal_stages;
create policy "team can view deal_stages"
  on crm.deal_stages for select
  to authenticated
  using (crm.is_active_team_member());

drop policy "team can view organisations" on crm.organisations;
create policy "team can view organisations"
  on crm.organisations for select
  to authenticated
  using (crm.is_active_team_member());
drop policy "team can insert organisations" on crm.organisations;
create policy "team can insert organisations"
  on crm.organisations for insert
  to authenticated
  with check (crm.is_active_team_member() and created_by = auth.uid());
drop policy "team can update organisations" on crm.organisations;
create policy "team can update organisations"
  on crm.organisations for update
  to authenticated
  using (crm.is_active_team_member())
  with check (crm.is_active_team_member());

drop policy "team can view contacts" on crm.contacts;
create policy "team can view contacts"
  on crm.contacts for select
  to authenticated
  using (crm.is_active_team_member());
drop policy "team can insert contacts" on crm.contacts;
create policy "team can insert contacts"
  on crm.contacts for insert
  to authenticated
  with check (crm.is_active_team_member() and created_by = auth.uid());
drop policy "team can update contacts" on crm.contacts;
create policy "team can update contacts"
  on crm.contacts for update
  to authenticated
  using (crm.is_active_team_member())
  with check (crm.is_active_team_member());

drop policy "team can view deals" on crm.deals;
create policy "team can view deals"
  on crm.deals for select
  to authenticated
  using (crm.is_active_team_member());
drop policy "team can insert deals" on crm.deals;
create policy "team can insert deals"
  on crm.deals for insert
  to authenticated
  with check (crm.is_active_team_member() and created_by = auth.uid());
drop policy "team can update deals" on crm.deals;
create policy "team can update deals"
  on crm.deals for update
  to authenticated
  using (crm.is_active_team_member())
  with check (crm.is_active_team_member());

drop policy "team can view activity_events" on crm.activity_events;
create policy "team can view activity_events"
  on crm.activity_events for select
  to authenticated
  using (crm.is_active_team_member());
drop policy "team can insert activity_events" on crm.activity_events;
create policy "team can insert activity_events"
  on crm.activity_events for insert
  to authenticated
  with check (
    crm.is_active_team_member()
    and (actor_id is null or actor_id = auth.uid())
  );

drop policy "team can view tasks" on crm.tasks;
create policy "team can view tasks"
  on crm.tasks for select
  to authenticated
  using (crm.is_active_team_member());
drop policy "team can insert tasks" on crm.tasks;
create policy "team can insert tasks"
  on crm.tasks for insert
  to authenticated
  with check (crm.is_active_team_member() and created_by = auth.uid());
drop policy "team can update tasks" on crm.tasks;
create policy "team can update tasks"
  on crm.tasks for update
  to authenticated
  using (crm.is_active_team_member())
  with check (crm.is_active_team_member());
