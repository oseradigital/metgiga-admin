import { test, expect } from "@playwright/test";
import {
  createThrowawayTeamMember,
  createTestOrganisation,
  deleteOrganisation,
  deleteAuthUser,
  loginAs,
  testAdminClient,
} from "./helpers";

test.describe("Overview page", () => {
  test("renders all four sections and is the default landing page after login", async ({ page }) => {
    let memberId: string | undefined;
    try {
      const member = await createThrowawayTeamMember("E2E Overview Sections");
      memberId = member.id;
      await loginAs(page, member.email, member.password);

      // loginAs already waits for network-idle after the redirect — this
      // is the actual "default landing page" assertion, not just that
      // /overview exists somewhere.
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
      await expect(page.getByText("Needs attention")).toBeVisible();
      await expect(page.getByText("Pipeline")).toBeVisible();
      await expect(page.getByText("My tasks")).toBeVisible();
      await expect(page.getByText("Recent activity")).toBeVisible();
    } finally {
      if (memberId) await deleteAuthUser(memberId);
    }
  });

  test("an organisation with no next action and no activity appears in Needs attention with the stated reason", async ({ page }) => {
    let memberId: string | undefined;
    let orgId: string | undefined;
    const orgName = `E2E Needs Attention ${Date.now()}`;

    try {
      const member = await createThrowawayTeamMember("E2E Needs Attention");
      memberId = member.id;
      orgId = await createTestOrganisation(orgName, member.id);

      await loginAs(page, member.email, member.password);
      await page.goto("/");

      const row = page.getByRole("link", { name: new RegExp(orgName) });
      await expect(row).toBeVisible();
      await expect(row).toContainText("No next action");
      await expect(row).toContainText("No activity yet");
    } finally {
      if (orgId) await deleteOrganisation(orgId);
      if (memberId) await deleteAuthUser(memberId);
    }
  });

  test("an organisation with a next action and recent activity does not appear in Needs attention", async ({ page }) => {
    let memberId: string | undefined;
    let orgId: string | undefined;
    const orgName = `E2E Attended ${Date.now()}`;

    try {
      const member = await createThrowawayTeamMember("E2E Attended Org");
      memberId = member.id;
      orgId = await createTestOrganisation(orgName, member.id);
      // needsAttentionReason is an OR — missing either condition alone
      // still qualifies. Both need to be satisfied to prove full
      // exclusion: a deal (gives real "last activity" via the
      // deals_log_activity trigger) AND an open task (gives a next
      // action). An earlier version of this test only did the deal half
      // and asserted the org was fully absent — wrong assertion, not an
      // app bug: it correctly still showed up for "No next action".
      await testAdminClient()
        .schema("crm")
        .from("deals")
        .insert({ organisation_id: orgId, title: "E2E deal", stage: "discovery_booked", created_by: member.id });
      await testAdminClient()
        .schema("crm")
        .from("tasks")
        .insert({ organisation_id: orgId, title: "E2E task", status: "open", created_by: member.id });

      await loginAs(page, member.email, member.password);
      await page.goto("/");

      // Scoped to the Needs attention section specifically — the org's
      // name legitimately also appears in the Recent activity feed
      // below (its deal.created event), which an unscoped page-wide
      // locator would also match.
      const needsAttention = page.locator("section", { hasText: "Needs attention" });
      await expect(needsAttention.getByRole("link", { name: new RegExp(orgName) })).toHaveCount(0);
    } finally {
      if (orgId) await deleteOrganisation(orgId);
      if (memberId) await deleteAuthUser(memberId);
    }
  });

  test("pipeline shows the correct count and value for a seeded deal's stage", async ({ page }) => {
    let memberId: string | undefined;
    let orgId: string | undefined;

    try {
      const member = await createThrowawayTeamMember("E2E Pipeline Overview");
      memberId = member.id;
      orgId = await createTestOrganisation(`E2E Pipeline Overview Org ${Date.now()}`, member.id);
      await testAdminClient()
        .schema("crm")
        .from("deals")
        .insert({ organisation_id: orgId, title: "E2E Overview Deal", stage: "verbal_yes", monthly_value: 2500, created_by: member.id });

      await loginAs(page, member.email, member.password);
      await page.goto("/");

      // Scoped to the Verbal Yes row specifically, since other deals may
      // already exist in the shared database for other stages.
      const stageRow = page.locator("li", { hasText: "Verbal Yes" });
      await expect(stageRow).toContainText("£2,500");
    } finally {
      if (orgId) await deleteOrganisation(orgId);
      if (memberId) await deleteAuthUser(memberId);
    }
  });

  test("My tasks reflects a due-today task assigned to the signed-in member", async ({ page }) => {
    let memberId: string | undefined;
    let orgId: string | undefined;
    let taskId: string | undefined;

    try {
      const member = await createThrowawayTeamMember("E2E My Tasks");
      memberId = member.id;
      orgId = await createTestOrganisation(`E2E My Tasks Org ${Date.now()}`, member.id);
      const { data: task } = await testAdminClient()
        .schema("crm")
        .from("tasks")
        .insert({
          organisation_id: orgId,
          title: "E2E due today",
          due_at: new Date().toISOString(),
          assigned_to: member.id,
          created_by: member.id,
        })
        .select("id")
        .single();
      taskId = task?.id;

      await loginAs(page, member.email, member.password);
      await page.goto("/");

      // "Due today" is the first stat tile in My tasks — scoped via the
      // section rather than a bare number, since "1" alone isn't a safe
      // locator.
      const myTasks = page.locator("section", { hasText: "My tasks" });
      await expect(myTasks.getByText("Due today")).toBeVisible();
      const dueTodayCount = await myTasks.locator("p.font-display").first().textContent();
      expect(Number(dueTodayCount)).toBeGreaterThanOrEqual(1);
    } finally {
      if (taskId) await testAdminClient().schema("crm").from("tasks").delete().eq("id", taskId);
      if (orgId) await deleteOrganisation(orgId);
      if (memberId) await deleteAuthUser(memberId);
    }
  });
});

test.describe("Nav active state", () => {
  test("the current page's nav link is visually distinguished", async ({ page }) => {
    let memberId: string | undefined;
    try {
      const member = await createThrowawayTeamMember("E2E Nav Active");
      memberId = member.id;
      await loginAs(page, member.email, member.password);

      await expect(page.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("link", { name: "Organisations" })).not.toHaveAttribute("aria-current", "page");

      await page.goto("/organisations");
      await expect(page.getByRole("link", { name: "Organisations" })).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current", "page");
    } finally {
      if (memberId) await deleteAuthUser(memberId);
    }
  });
});
