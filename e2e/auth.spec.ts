import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  createThrowawayTeamMember,
  createThrowawayNonMember,
  deleteAuthUser,
  deleteOrganisation,
  loginAs,
} from "./helpers";

// A minimal browser-equivalent client for the RLS test below —
// deliberately not lib/supabase/client.ts, which is a "use client" React
// module built for the app, not a plain Node/test context.
function anonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
}

test.describe("Login", () => {
  test("renders and validates without a real account", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Metgiga Admin" })).toBeVisible();

    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Enter your email address.")).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeFocused();
  });

  test("wrong password shows an error and does not navigate", async ({ page }) => {
    // Declared before try, assigned inside it — a real bug this build
    // hit directly: creating the fixture INSIDE try (or not at all) means
    // a failure partway through creation leaks it with no cleanup, since
    // finally never runs for a throw that happens before try starts.
    let memberId: string | undefined;
    try {
      const member = await createThrowawayTeamMember("E2E Wrong Password");
      memberId = member.id;

      await page.goto("/login");
      await page.getByLabel("Email address").fill(member.email);
      // See loginAs() in helpers.ts for why this is getByRole, not
      // getByLabel({exact:true}).
      await page.getByRole("textbox", { name: "Password", exact: true }).fill("definitely-not-the-password");
      const before = page.url();
      await page.getByRole("button", { name: "Log in" }).click();
      await expect(page.getByText("Invalid login credentials")).toBeVisible();
      expect(page.url()).toBe(before);
    } finally {
      if (memberId) await deleteAuthUser(memberId);
    }
  });

  test("a real account with no crm.team_members row is rejected with a specific reason", async ({ page }) => {
    let userId: string | undefined;
    try {
      const nonMember = await createThrowawayNonMember();
      userId = nonMember.id;

      await loginAs(page, nonMember.email, nonMember.password);
      await expect(page.getByText("This account doesn't have access to Metgiga Admin.")).toBeVisible();
      // Confirms the rejection actually signed them back out, not just
      // shown an error over a live session.
      await expect(page).toHaveURL(/\/login/);
    } finally {
      if (userId) await deleteAuthUser(userId);
    }
  });

  test("an active team member can log in and reach the protected home", async ({ page }) => {
    let memberId: string | undefined;
    try {
      const member = await createThrowawayTeamMember("E2E Login Success", "sales");
      memberId = member.id;

      await loginAs(page, member.email, member.password);
      // The protected landing page is now Overview (was a bare "Welcome,
      // {name}" placeholder) — confirming the redirect actually reached
      // an authenticated screen, not that specific page's old content.
      await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    } finally {
      if (memberId) await deleteAuthUser(memberId);
    }
  });
});

test.describe("RLS boundaries", () => {
  // This isn't a UI test — the app's own UI never lets a signed-in user
  // choose who a row's created_by is, so there's nothing to click that
  // would even attempt a spoof. What actually protects this app if that
  // UI assumption is ever wrong (a bug, a compromised client, a direct
  // API call bypassing the app entirely) is the database's RLS `with
  // check` clause itself — so that's what gets tested directly here,
  // the same technique used to verify this by hand throughout the build
  // (sign in as a real throwaway account, attempt the write for real).
  test("one team member cannot create a row attributed to another", async () => {
    let memberAId: string | undefined;
    let memberBId: string | undefined;
    let orgId: string | undefined;

    try {
      const anon = anonClient();
      const memberA = await createThrowawayTeamMember("E2E Attribution A");
      memberAId = memberA.id;
      const memberB = await createThrowawayTeamMember("E2E Attribution B");
      memberBId = memberB.id;

      const { data: session, error: signInError } = await anon.auth.signInWithPassword({
        email: memberA.email,
        password: memberA.password,
      });
      expect(signInError).toBeNull();
      expect(session.user?.id).toBe(memberA.id);

      // The attack: signed in as A, try to insert a row that claims to
      // have been created by B.
      const { data: spoofed, error: spoofError } = await anon
        .schema("crm")
        .from("organisations")
        .insert({ name: "E2E Spoof Attempt", created_by: memberB.id })
        .select("id")
        .maybeSingle();

      expect(spoofed).toBeNull();
      expect(spoofError).not.toBeNull();
      expect(spoofError?.code).toBe("42501"); // RLS policy violation

      // The legitimate case: same account, no created_by supplied —
      // must succeed and be attributed to the actual caller, not left
      // blank and not attributable to anyone else.
      const { data: real, error: realError } = await anon
        .schema("crm")
        .from("organisations")
        .insert({ name: "E2E Attribution Real" })
        .select("id, created_by")
        .single();
      expect(realError).toBeNull();
      expect(real?.created_by).toBe(memberA.id);
      orgId = real?.id;
    } finally {
      if (orgId) await deleteOrganisation(orgId);
      if (memberAId) await deleteAuthUser(memberAId);
      if (memberBId) await deleteAuthUser(memberBId);
    }
  });
});
