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
      // getByText, not getByRole/heading, here specifically: the empty
      // state's own copy ("Nothing needs attention right now.") contains
      // "needs attention" as a case-insensitive substring, so a bare
      // getByText("Needs attention") is ambiguous whenever nothing
      // currently qualifies — a real, previously-latent bug this test
      // hit once the grace-period change (final alignment pass) started
      // legitimately excluding organisations that used to always show.
      await expect(page.getByRole("heading", { name: "Needs attention" })).toBeVisible();
      // heading, not getByText, for the same reason — the new "Potential
      // pipeline" stat tile (final alignment pass) contains "Pipeline" as
      // a substring, which a bare getByText("Pipeline") would also match.
      await expect(page.getByRole("heading", { name: "Pipeline", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "My tasks" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Recent activity" })).toBeVisible();
    } finally {
      if (memberId) await deleteAuthUser(memberId);
    }
  });

  test("an organisation with no next action and no activity appears in Needs attention with the stated reason and a direct action", async ({ page }) => {
    let memberId: string | undefined;
    let orgId: string | undefined;
    // Deliberately NOT named "... Needs Attention ..." — the final
    // alignment pass's organisation.created trigger now logs a Recent
    // Activity entry the moment this org is created, and that entry
    // mentions the org by name. A name containing the section heading's
    // own text made `section.filter({hasText: "Needs attention"})`
    // ambiguously also match the Recent Activity section once that
    // entry existed — a real cross-section collision, not a flake.
    const orgName = `E2E Attention Required ${Date.now()}`;

    try {
      const member = await createThrowawayTeamMember("E2E Attention Required");
      memberId = member.id;
      // Backdated past NEW_ORGANISATION_GRACE_HOURS (48h) — a
      // just-created organisation is deliberately excluded from Needs
      // attention (final alignment spec: don't flag brand-new orgs), so
      // this test has to simulate an org old enough to actually qualify.
      orgId = await createTestOrganisation(orgName, member.id, {
        created_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
      });

      await loginAs(page, member.email, member.password);
      await page.goto("/");

      const needsAttention = page.locator("section", { hasText: "Needs attention" });
      const row = needsAttention.getByRole("link", { name: orgName, exact: true });
      await expect(row).toBeVisible();
      const rowContainer = needsAttention.locator("li", { hasText: orgName });
      await expect(rowContainer).toContainText("No next action");
      await expect(rowContainer.getByRole("link", { name: "Add task" })).toBeVisible();
    } finally {
      if (orgId) await deleteOrganisation(orgId);
      if (memberId) await deleteAuthUser(memberId);
    }
  });

  test("a brand-new organisation does not appear in Needs attention, even with no next action or activity", async ({ page }) => {
    let memberId: string | undefined;
    let orgId: string | undefined;
    const orgName = `E2E Grace Period ${Date.now()}`;

    try {
      const member = await createThrowawayTeamMember("E2E Grace Period");
      memberId = member.id;
      // No created_at override — a genuinely brand-new organisation.
      orgId = await createTestOrganisation(orgName, member.id);

      await loginAs(page, member.email, member.password);
      await page.goto("/");

      const needsAttention = page.locator("section", { hasText: "Needs attention" });
      await expect(needsAttention.getByRole("link", { name: orgName, exact: true })).toHaveCount(0);
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

  test("My tasks reflects a due-today task assigned to the signed-in member, as an actual list item with a link", async ({ page }) => {
    let memberId: string | undefined;
    let orgId: string | undefined;
    let taskId: string | undefined;
    // Not "... My Tasks ..." — same section-name collision risk fixed
    // above for the Needs attention test, latent here too since
    // organisation.created now puts this org's name in Recent activity
    // immediately, which section.filter({hasText: "My tasks"}) could
    // then also match.
    const orgName = `E2E Due Today Org ${Date.now()}`;

    try {
      const member = await createThrowawayTeamMember("E2E Due Today");
      memberId = member.id;
      orgId = await createTestOrganisation(orgName, member.id);
      const { data: task } = await testAdminClient()
        .schema("crm")
        .from("tasks")
        .insert({
          organisation_id: orgId,
          title: "E2E due today task",
          due_at: new Date().toISOString(),
          assigned_to: member.id,
          created_by: member.id,
        })
        .select("id")
        .single();
      taskId = task?.id;

      await loginAs(page, member.email, member.password);
      await page.goto("/");

      // Not just a count — the final alignment pass replaced the two
      // bare number tiles with an actual, clickable list of what's due.
      const myTasks = page.locator("section", { hasText: "My tasks" });
      await expect(myTasks.getByText(/\d+ due today/)).toBeVisible();
      const taskLink = myTasks.getByRole("link", { name: /E2E due today task/ });
      await expect(taskLink).toBeVisible();
      await expect(taskLink).toContainText(orgName);
      await expect(taskLink).toHaveAttribute("href", `/organisations/${orgId}?tab=tasks`);
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
