import { test, expect } from "@playwright/test";
import {
  createThrowawayTeamMember,
  createThrowawayNonMember,
  createTestOrganisation,
  createTestOnboardingRecord,
  deleteOrganisation,
  deleteOnboardingRecord,
  deleteAuthUser,
  loginAs,
  testAdminClient,
  anonClient,
} from "./helpers";

test.describe("Onboarding tab", () => {
  test("an organisation with no linked record shows the link-search UI, and linking makes the data appear", async ({ page }) => {
    let memberId: string | undefined;
    let orgId: string | undefined;
    let onboardingId: string | undefined;
    const businessName = `E2E Onboarding Business ${Date.now()}`;

    try {
      const member = await createThrowawayTeamMember("E2E Onboarding Link");
      memberId = member.id;
      orgId = await createTestOrganisation(`E2E Onboarding Org ${Date.now()}`, member.id);
      const record = await createTestOnboardingRecord({
        business_name: businessName,
        primary_contact_email: "e2e-onboarding-contact@example.com",
      });
      onboardingId = record.id;

      await loginAs(page, member.email, member.password);
      await page.goto(`/organisations/${orgId}?tab=onboarding`);

      await expect(page.getByPlaceholder("Search onboarding submissions…")).toBeVisible();
      await page.getByPlaceholder("Search onboarding submissions…").fill(businessName);
      const resultRow = page.locator("li", { hasText: businessName });
      await expect(resultRow.getByRole("button", { name: "Link" })).toBeVisible({ timeout: 10_000 });
      await resultRow.getByRole("button", { name: "Link" }).click();

      // Confirmed against the database, not just the UI — same
      // discipline as every other write path in this build.
      await expect
        .poll(async () => {
          const { data } = await testAdminClient().from("onboarding_records").select("organisation_id").eq("id", onboardingId).single();
          return data?.organisation_id;
        })
        .toBe(orgId);

      await expect(page.getByText("In progress")).toBeVisible();
      await expect(page.getByText(businessName)).toBeVisible();
    } finally {
      if (onboardingId) await deleteOnboardingRecord(onboardingId);
      if (orgId) await deleteOrganisation(orgId);
      if (memberId) await deleteAuthUser(memberId);
    }
  });

  test("a signed-in client (not a team member) cannot link an onboarding record via the RPC, even directly", async () => {
    let nonMemberId: string | undefined;
    let orgId: string | undefined;
    let onboardingId: string | undefined;
    let ownerMemberId: string | undefined;

    try {
      const owner = await createThrowawayTeamMember("E2E Onboarding RLS Owner");
      ownerMemberId = owner.id;
      orgId = await createTestOrganisation(`E2E Onboarding RLS Org ${Date.now()}`, owner.id);
      const record = await createTestOnboardingRecord();
      onboardingId = record.id;

      const nonMember = await createThrowawayNonMember();
      nonMemberId = nonMember.id;
      const nonMemberClient = anonClient();
      const { data: signIn, error: signInError } = await nonMemberClient.auth.signInWithPassword({
        email: nonMember.email,
        password: nonMember.password,
      });
      expect(signInError).toBeNull();
      expect(signIn.session).not.toBeNull();

      const { error: rpcError } = await nonMemberClient.rpc("link_onboarding_record_to_organisation", {
        onboarding_id: onboardingId,
        org_id: orgId,
      });
      // crm.is_active_team_member() correctly fails this session — the
      // function's own internal check, not a table grant, is what
      // refuses it (migration 0014's stated reasoning for using an RPC
      // instead of a column grant in the first place).
      expect(rpcError).not.toBeNull();

      const { data: unchanged } = await testAdminClient().from("onboarding_records").select("organisation_id").eq("id", onboardingId).single();
      expect(unchanged?.organisation_id).toBeNull();
    } finally {
      if (onboardingId) await deleteOnboardingRecord(onboardingId);
      if (orgId) await deleteOrganisation(orgId);
      if (nonMemberId) await deleteAuthUser(nonMemberId);
      if (ownerMemberId) await deleteAuthUser(ownerMemberId);
    }
  });

  test("a team member can read a linked onboarding record's data via RLS, independent of the app's own UI", async () => {
    let memberId: string | undefined;
    let orgId: string | undefined;
    let onboardingId: string | undefined;

    try {
      const member = await createThrowawayTeamMember("E2E Onboarding Team Read");
      memberId = member.id;
      orgId = await createTestOrganisation(`E2E Onboarding Team Read Org ${Date.now()}`, member.id);
      const record = await createTestOnboardingRecord({ organisation_id: orgId, business_name: "E2E RLS Read Business" });
      onboardingId = record.id;

      const memberClient = anonClient();
      const { error: signInError } = await memberClient.auth.signInWithPassword({ email: member.email, password: member.password });
      expect(signInError).toBeNull();

      const { data, error } = await memberClient.from("onboarding_records").select("business_name").eq("id", onboardingId).single();
      expect(error).toBeNull();
      expect(data?.business_name).toBe("E2E RLS Read Business");
    } finally {
      if (onboardingId) await deleteOnboardingRecord(onboardingId);
      if (orgId) await deleteOrganisation(orgId);
      if (memberId) await deleteAuthUser(memberId);
    }
  });

  test("linking an already-complete onboarding record logs a single onboarding.completed activity event", async ({ page }) => {
    let memberId: string | undefined;
    let orgId: string | undefined;
    let onboardingId: string | undefined;

    try {
      const member = await createThrowawayTeamMember("E2E Onboarding Completed Event");
      memberId = member.id;
      orgId = await createTestOrganisation(`E2E Onboarding Completed Org ${Date.now()}`, member.id);

      // "Complete" per crm.log_onboarding_completed / the portal's own
      // getOnboardingRecordByToken: onboarding_completed_at is set (a
      // plain timestamp — no auth.users FK to satisfy). The real flow
      // also sets auth_user_id in the same write.
      const record = await createTestOnboardingRecord({
        onboarding_completed_at: new Date().toISOString(),
        agreement_status: "signed",
        payment_confirmed: true,
      });
      onboardingId = record.id;

      // Linking while already complete — the "linked after completion"
      // path through the trigger, not "completed after linking".
      // Signed in as the team member, not testAdminClient() (service
      // role) — the RPC's crm.is_active_team_member() check reads
      // auth.uid(), which is null for an unauthenticated service-role
      // call and correctly gets refused. This has to go through a real
      // signed-in session, same as the actual app does via a Server
      // Action.
      const memberClient = anonClient();
      const { error: memberSignInError } = await memberClient.auth.signInWithPassword({ email: member.email, password: member.password });
      expect(memberSignInError).toBeNull();
      const { error: linkError } = await memberClient.rpc("link_onboarding_record_to_organisation", {
        onboarding_id: onboardingId,
        org_id: orgId,
      });
      expect(linkError).toBeNull();

      await expect
        .poll(async () => {
          const { data } = await testAdminClient()
            .schema("crm")
            .from("activity_events")
            .select("id")
            .eq("organisation_id", orgId)
            .eq("event_type", "onboarding.completed");
          return data?.length ?? 0;
        })
        .toBe(1);

      await loginAs(page, member.email, member.password);
      await page.goto(`/organisations/${orgId}?tab=activity`);
      // exact: true — this test's own member/org names ("E2E Onboarding
      // Completed Event" / "... Org") both contain "Onboarding
      // completed" as a case-insensitive substring (sidebar account
      // name, page heading), which a loose getByText also matches.
      // describeActivityEvent's actual returned string for this event is
      // exactly "Onboarding completed", nothing appended, so exact
      // matching is both correct and sufficient here.
      await expect(page.getByText("Onboarding completed", { exact: true })).toBeVisible();
    } finally {
      if (onboardingId) await deleteOnboardingRecord(onboardingId);
      if (orgId) await deleteOrganisation(orgId);
      if (memberId) await deleteAuthUser(memberId);
    }
  });
});

test.describe("Organisation created activity", () => {
  test("creating an organisation logs an organisation.created event, visible on its Activity tab and Overview's Recent activity", async ({ page }) => {
    let memberId: string | undefined;
    let orgId: string | undefined;
    const orgName = `E2E Org Created Event ${Date.now()}`;

    try {
      const member = await createThrowawayTeamMember("E2E Org Created Event");
      memberId = member.id;
      orgId = await createTestOrganisation(orgName, member.id);

      await expect
        .poll(async () => {
          const { data } = await testAdminClient()
            .schema("crm")
            .from("activity_events")
            .select("id")
            .eq("organisation_id", orgId)
            .eq("event_type", "organisation.created");
          return data?.length ?? 0;
        })
        .toBe(1);

      await loginAs(page, member.email, member.password);
      await page.goto(`/organisations/${orgId}?tab=activity`);
      await expect(page.getByText("created this organisation")).toBeVisible();

      await page.goto("/");
      const recentActivity = page.locator("section", { hasText: "Recent activity" });
      await expect(recentActivity.getByText(orgName)).toBeVisible();
    } finally {
      if (orgId) await deleteOrganisation(orgId);
      if (memberId) await deleteAuthUser(memberId);
    }
  });
});
