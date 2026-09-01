import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

// Admin-privileged client for test setup/teardown — same pattern as
// metgiga-portal's e2e suite: create real rows via the service role
// (bypassing RLS, since this is fixture setup, not the thing under
// test), verify through the real app under RLS, delete afterward.
// Requires SUPABASE_SERVICE_ROLE_KEY, present only in .env.local (see
// its comment there) and never used by the app's own runtime code.
export function testAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set to run the E2E suite. " +
        "`npx dotenv -e .env.local -- ...` (the portal's suggested pattern) doesn't resolve " +
        "cleanly without dotenv-cli installed — verified working instead: " +
        "`set -a; source .env.local; set +a; npx playwright test`.",
    );
  }
  return createClient(url, key);
}

// A minimal browser-equivalent client (anon key, no session persistence)
// for signing in as a specific real user and exercising RLS directly —
// as opposed to testAdminClient(), which is the service role and
// bypasses RLS entirely. Shared here rather than redefined per spec
// file (was previously local to auth.spec.ts).
export function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY must be set to run the E2E suite.");
  }
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

export type TeamMemberRole = "owner" | "sales" | "account_manager" | "production";

// A REAL, throwaway auth account with a real password this test suite
// itself chose — not the founders' actual accounts, which no one but
// Saif/Abubakar knows the password to, and which this suite has no
// business touching. Distinct from the "impersonate a live user's
// session" pattern that was correctly refused earlier this build: this
// creates and controls its own disposable identity end to end.
export async function createThrowawayTeamMember(
  fullName: string,
  role: TeamMemberRole = "sales",
): Promise<{ id: string; email: string; password: string; fullName: string }> {
  const admin = testAdminClient();
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = `E2eTest!${Math.random().toString(36).slice(2)}`;

  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`Could not create throwaway auth user: ${error?.message}`);

  const { error: memberError } = await admin
    .schema("crm")
    .from("team_members")
    .insert({ id: data.user.id, full_name: fullName, email, role, is_active: true });
  if (memberError) throw new Error(`Could not create crm.team_members row: ${memberError.message}`);

  return { id: data.user.id, email, password, fullName };
}

// A real auth user with NO crm.team_members row — for testing that
// authentication alone isn't sufficient for admin access.
export async function createThrowawayNonMember(): Promise<{ id: string; email: string; password: string }> {
  const admin = testAdminClient();
  const email = `e2e-nonmember-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = `E2eTest!${Math.random().toString(36).slice(2)}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`Could not create throwaway non-member: ${error?.message}`);
  return { id: data.user.id, email, password };
}

// crm.team_members.id references auth.users(id) on delete cascade
// (0007) — deleting the auth user is enough to remove the team_members
// row too.
//
// Throws on a genuine failure rather than swallowing it — a real bug
// this build hit directly: every cleanup call this whole session used
// .catch(() => {}) or discarded its result entirely, so a missing
// service_role grant on the crm schema made every cleanup silently
// fail while every test kept reporting green, leaving real orphaned
// rows in the shared database undetected for hours. A cleanup that
// can't clean up must fail the test, not hide it.
export async function deleteAuthUser(userId: string) {
  const { error } = await testAdminClient().auth.admin.deleteUser(userId);
  // "User not found" is fine — idempotent, already gone. Anything else
  // (permissions, network, a schema/grant regression like the one that
  // caused this) must surface, not disappear.
  if (error && error.status !== 404) {
    throw new Error(`Cleanup failed: could not delete auth user ${userId}: ${error.message}`);
  }
}

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  // getByRole, not getByLabel — the required Field's "*" is aria-hidden
  // (correctly excluded from the accessible name getByRole computes,
  // which is why { name: "Password", exact: true } here matches
  // cleanly), but getByLabel({exact:true}) matches the <label>'s raw
  // DOM text instead, which literally includes that "*" character.
  // getByLabel("Password", {exact:true}) matches nothing as a result and
  // hangs until timeout rather than erroring — found by tracing an
  // actual stuck test, not assumed. getByRole also sidesteps the
  // "Show password" button's aria-label ("Show password") ever being a
  // candidate at all, since its role is "button", not "textbox".
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();

  // A real race found while testing the pipeline suite: the click
  // resolves as soon as the browser dispatches it, not once the async
  // handler behind it (sign in, then a second query checking
  // crm.team_members, then only THEN router.push("/")) finishes. A test
  // that navigates elsewhere immediately after loginAs() could do so
  // before the session cookie the next page depends on is actually set
  // — which surfaced as crm.* reads failing with "permission denied for
  // schema crm" (i.e. running as anon, not authenticated) on whatever
  // page loaded next, not as a login failure at all. Waiting for network
  // idle here covers every outcome (success -> "/", rejection -> stays
  // on /login with an error) without this helper needing to assume
  // which one happened.
  await page.waitForLoadState("networkidle");
}

// createdBy is required, not optional — created_by is `not null default
// auth.uid()`, and a service-role request has no auth.uid() (no signed-
// in user, so the default evaluates to null), which the not-null
// constraint then rejects. Found this the same way as everything else
// in this build: the insert actually failed, not assumed to work.
// Pass a real throwaway team member's id, not one of the founders' —
// fixture data shouldn't get attributed to a real person.
export async function createTestOrganisation(
  name: string,
  createdBy: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const admin = testAdminClient();
  const { data, error } = await admin
    .schema("crm")
    .from("organisations")
    .insert({ name, created_by: createdBy, ...overrides })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Could not create test organisation: ${error?.message}`);
  return data.id;
}

export async function deleteOrganisation(id: string) {
  // FKs from deals/contacts/tasks/activity_events are all "on delete
  // cascade" or nullable-on-delete back to organisations (0007) — one
  // delete here is enough, no manual child cleanup needed.
  //
  // `count: "exact"` + checking it, not just `error` — a delete with a
  // bad/mistyped id also returns no error but deletes 0 rows, which
  // would otherwise look identical to a successful cleanup.
  const { error, count } = await testAdminClient()
    .schema("crm")
    .from("organisations")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) throw new Error(`Cleanup failed: could not delete test organisation ${id}: ${error.message}`);
  if (count !== 1) throw new Error(`Cleanup failed: expected to delete 1 organisation (${id}), deleted ${count}.`);
}

// onboarding_records lives in `public` (the Client Portal's schema), not
// crm — no .schema() call, same as lib/crm/onboarding.ts's app-side
// reads. access_token stands in for a real invite token; nothing here
// exercises the actual invite-generation code path, only the
// organisation-link/RLS/trigger behaviour built for the final alignment
// pass (migration 0014/0007).
export async function createTestOnboardingRecord(overrides: Record<string, unknown> = {}): Promise<{ id: string; accessToken: string }> {
  const admin = testAdminClient();
  const accessToken = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const { data, error } = await admin
    .from("onboarding_records")
    .insert({ access_token: accessToken, business_name: `E2E Onboarding ${Date.now()}`, ...overrides })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Could not create test onboarding record: ${error?.message}`);
  return { id: data.id, accessToken };
}

export async function deleteOnboardingRecord(id: string) {
  const { error, count } = await testAdminClient()
    .from("onboarding_records")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) throw new Error(`Cleanup failed: could not delete test onboarding record ${id}: ${error.message}`);
  if (count !== 1) throw new Error(`Cleanup failed: expected to delete 1 onboarding record (${id}), deleted ${count}.`);
}

export async function createTestDeal(
  organisationId: string,
  title: string,
  stage: string,
  createdBy: string,
): Promise<string> {
  const admin = testAdminClient();
  const { data, error } = await admin
    .schema("crm")
    .from("deals")
    .insert({ organisation_id: organisationId, title, stage, created_by: createdBy })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Could not create test deal: ${error?.message}`);
  return data.id;
}
