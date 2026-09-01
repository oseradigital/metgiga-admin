import { test, expect } from "@playwright/test";
import {
  createThrowawayTeamMember,
  createTestOrganisation,
  deleteOrganisation,
  deleteAuthUser,
  loginAs,
  testAdminClient,
} from "./helpers";

// Covers the acceptance test for the UX refinement pass: create a
// prospect with minimal info, search for it, filter by status, and
// reach its detail page — entirely through the UI.
test.describe("Organisations — lightweight creation, search, filter", () => {
  test("creating an organisation with only a name reaches its detail page", async ({ page }) => {
    let memberId: string | undefined;
    let orgName: string | undefined;

    try {
      const member = await createThrowawayTeamMember("E2E Org Creator");
      memberId = member.id;
      orgName = `E2E Minimal Org ${Date.now()}`;

      await loginAs(page, member.email, member.password);
      await page.goto("/organisations/new");

      // Only the name field — every other field on this form is
      // optional, exactly the "cold prospect" scenario this form was
      // trimmed down for.
      // getByRole, not getByLabel — same reasoning as loginAs() in
      // helpers.ts: this field is required, so its <label> text is
      // literally "Name*" (aria-hidden doesn't affect raw DOM text),
      // which getByLabel(exact:true) can never exactly match — it hangs
      // to timeout instead of erroring. getByRole's accessible-name
      // computation correctly excludes the aria-hidden asterisk.
      await page.getByRole("textbox", { name: "Name", exact: true }).fill(orgName);
      await page.getByRole("button", { name: "Create organisation" }).click();

      await expect(page.getByRole("heading", { name: orgName })).toBeVisible();
      await expect(page.getByRole("button", { name: "Overview" })).toBeVisible();
    } finally {
      if (orgName) {
        const { data } = await testAdminClient().schema("crm").from("organisations").select("id").eq("name", orgName).maybeSingle();
        if (data) await deleteOrganisation(data.id);
      }
      if (memberId) await deleteAuthUser(memberId);
    }
  });

  test("blank name is blocked before any request is made", async ({ page }) => {
    let memberId: string | undefined;
    try {
      const member = await createThrowawayTeamMember("E2E Blank Org");
      memberId = member.id;
      await loginAs(page, member.email, member.password);

      await page.goto("/organisations/new");
      const before = page.url();
      await page.getByRole("button", { name: "Create organisation" }).click();
      await expect(page.getByText("Enter an organisation name.")).toBeVisible();
      expect(page.url()).toBe(before);
    } finally {
      if (memberId) await deleteAuthUser(memberId);
    }
  });

  test("search matches by organisation name", async ({ page }) => {
    let memberId: string | undefined;
    let orgId: string | undefined;
    const uniqueName = `E2E Searchable ${Date.now()}`;

    try {
      const member = await createThrowawayTeamMember("E2E Search Name");
      memberId = member.id;
      orgId = await createTestOrganisation(uniqueName, member.id);

      await loginAs(page, member.email, member.password);
      await page.goto("/organisations");
      await page.getByLabel("Search organisations").fill(uniqueName);

      await expect(page.getByRole("link", { name: uniqueName })).toBeVisible();
      // Nothing else should still be showing once the search narrows to
      // a string unique to this one fixture.
      const rows = page.locator("table tbody tr");
      await expect(rows).toHaveCount(1);
    } finally {
      if (orgId) await deleteOrganisation(orgId);
      if (memberId) await deleteAuthUser(memberId);
    }
  });

  test("search matches by primary contact name and email", async ({ page }) => {
    let memberId: string | undefined;
    let orgId: string | undefined;
    const contactEmail = `e2e-contact-${Date.now()}@example.com`;

    try {
      const member = await createThrowawayTeamMember("E2E Search Contact");
      memberId = member.id;
      orgId = await createTestOrganisation(`E2E Contact Org ${Date.now()}`, member.id);
      // created_by explicit, not defaulted — same reason as
      // createTestOrganisation/createTestDeal in helpers.ts: a
      // service-role insert has no auth.uid() to default from, and
      // contacts.created_by is not-null. Found this exact way (an
      // unchecked insert failing silently) once already this session;
      // checking the error here so it can't happen unnoticed again.
      const { error: contactError } = await testAdminClient()
        .schema("crm")
        .from("contacts")
        .insert({ organisation_id: orgId, first_name: "Zendaya", last_name: "Unique", email: contactEmail, is_primary: true, created_by: member.id });
      expect(contactError).toBeNull();

      await loginAs(page, member.email, member.password);
      await page.goto("/organisations");

      // Scoped to the desktop table, not a bare getByText — both the
      // desktop table row and the mobile stacked-list row for this same
      // organisation exist in the DOM at once (only one is CSS-hidden at
      // the current viewport), so an unscoped getByText matches both and
      // Playwright refuses the ambiguous locator even though only one is
      // actually visible.
      const desktopRow = page.locator("table tbody");
      await page.getByLabel("Search organisations").fill("Zendaya");
      await expect(desktopRow.getByText("Zendaya Unique")).toBeVisible();

      await page.getByLabel("Search organisations").fill(contactEmail);
      await expect(desktopRow.getByText("Zendaya Unique")).toBeVisible();
    } finally {
      if (orgId) await deleteOrganisation(orgId);
      if (memberId) await deleteAuthUser(memberId);
    }
  });

  test("no results for a search shows the scoped empty state, not the zero-organisations one", async ({ page }) => {
    let memberId: string | undefined;
    try {
      const member = await createThrowawayTeamMember("E2E Search Empty");
      memberId = member.id;
      await loginAs(page, member.email, member.password);

      await page.goto("/organisations");
      await page.getByLabel("Search organisations").fill(`nonexistent-${Date.now()}`);
      await expect(page.getByText("No organisations match your search.")).toBeVisible();
      // The zero-organisations empty state has different copy and a CTA
      // — confirm this scoped one didn't just fall through to that.
      await expect(page.getByText("create your first organisation")).toHaveCount(0);
    } finally {
      if (memberId) await deleteAuthUser(memberId);
    }
  });

  test("status filter narrows the list and updates counts", async ({ page }) => {
    let memberId: string | undefined;
    let orgId: string | undefined;

    try {
      const member = await createThrowawayTeamMember("E2E Status Filter");
      memberId = member.id;
      const orgName = `E2E Active Org ${Date.now()}`;
      orgId = await createTestOrganisation(orgName, member.id);
      await testAdminClient().schema("crm").from("organisations").update({ status: "active" }).eq("id", orgId);

      await loginAs(page, member.email, member.password);
      await page.goto("/organisations");
      // Narrow with search first so this fixture's counts are
      // deterministic regardless of whatever else exists in the shared
      // database.
      await page.getByLabel("Search organisations").fill(orgName);

      await expect(page.getByRole("button", { name: "Active 1" })).toBeVisible();
      await page.getByRole("button", { name: "Active 1" }).click();
      await expect(page.getByRole("link", { name: orgName })).toBeVisible();

      await page.getByRole("button", { name: /^Prospect /, exact: false }).click();
      await expect(page.getByText("No organisations in this status.")).toBeVisible();
    } finally {
      if (orgId) await deleteOrganisation(orgId);
      if (memberId) await deleteAuthUser(memberId);
    }
  });
});

test.describe("Organisations table — row click, columns", () => {
  test("clicking directly on the organisation name navigates (not just elsewhere in the row)", async ({ page }) => {
    // Specifically the name text, not some other cell — this is the
    // exact spot a real bug lived: the visible name span painted above
    // the row's full-width stretched link and silently swallowed clicks
    // landing on it, which is precisely where a user is most likely to
    // click. A test that only clicked an empty cell wouldn't have
    // caught it.
    let memberId: string | undefined;
    let orgId: string | undefined;
    const orgName = `E2E Name Click ${Date.now()}`;

    try {
      const member = await createThrowawayTeamMember("E2E Name Click");
      memberId = member.id;
      orgId = await createTestOrganisation(orgName, member.id);

      await loginAs(page, member.email, member.password);
      await page.goto("/organisations");

      await page.getByRole("link", { name: orgName }).click();
      await expect(page).toHaveURL(new RegExp(`/organisations/${orgId}`));
    } finally {
      if (orgId) await deleteOrganisation(orgId);
      if (memberId) await deleteAuthUser(memberId);
    }
  });

  test("clicking elsewhere in the row (not the name) also navigates", async ({ page }) => {
    let memberId: string | undefined;
    let orgId: string | undefined;
    const orgName = `E2E Row Click ${Date.now()}`;

    try {
      const member = await createThrowawayTeamMember("E2E Row Click");
      memberId = member.id;
      orgId = await createTestOrganisation(orgName, member.id);

      await loginAs(page, member.email, member.password);
      await page.goto("/organisations");

      // The Status cell — deliberately not the name link. force: true is
      // load-bearing and deliberate, not a workaround for a real bug:
      // the row's stretched link lives inside the FIRST <td> and covers
      // the whole row only via absolute positioning, so from this cell's
      // perspective the link is a non-descendant element overlapping it.
      // Playwright's actionability check treats that as "obscured" and
      // waits forever, even though a real click at that pixel correctly
      // hits the link — confirmed directly with elementFromPoint()
      // against the live page before writing this, not assumed.
      const row = page.locator("tr", { hasText: orgName });
      await row.locator("td").nth(2).click({ force: true });
      await expect(page).toHaveURL(new RegExp(`/organisations/${orgId}`));
    } finally {
      if (orgId) await deleteOrganisation(orgId);
      if (memberId) await deleteAuthUser(memberId);
    }
  });

  test("search state survives navigating into an organisation and back", async ({ page }) => {
    let memberId: string | undefined;
    let orgId: string | undefined;
    const orgName = `E2E Preserve Search ${Date.now()}`;

    try {
      const member = await createThrowawayTeamMember("E2E Preserve Search");
      memberId = member.id;
      orgId = await createTestOrganisation(orgName, member.id);

      await loginAs(page, member.email, member.password);
      await page.goto("/organisations");
      await page.getByLabel("Search organisations").fill(orgName);
      await expect(page).toHaveURL(/[?&]q=/);

      await page.getByRole("link", { name: orgName }).click();
      await expect(page).toHaveURL(new RegExp(`/organisations/${orgId}`));

      await page.getByRole("link", { name: "← Organisations" }).click();
      await expect(page.getByLabel("Search organisations")).toHaveValue(orgName);
      await expect(page.getByRole("link", { name: orgName })).toBeVisible();
    } finally {
      if (orgId) await deleteOrganisation(orgId);
      if (memberId) await deleteAuthUser(memberId);
    }
  });

  test("active deal shows package and stage together, falling back to title if no package", async ({ page }) => {
    let memberId: string | undefined;
    let orgId: string | undefined;
    const orgName = `E2E Deal Label ${Date.now()}`;

    try {
      const member = await createThrowawayTeamMember("E2E Deal Label");
      memberId = member.id;
      orgId = await createTestOrganisation(orgName, member.id);
      await testAdminClient()
        .schema("crm")
        .from("deals")
        .insert({ organisation_id: orgId, title: "Some deal title", package: "Full Funnel", stage: "proposal", monthly_value: 1800, created_by: member.id });

      await loginAs(page, member.email, member.password);
      await page.goto("/organisations");

      const row = page.locator("tr", { hasText: orgName });
      await expect(row).toContainText("Full Funnel · Proposal");
      await expect(row).not.toContainText("Some deal title");
      await expect(row).toContainText("£1,800");
    } finally {
      if (orgId) await deleteOrganisation(orgId);
      if (memberId) await deleteAuthUser(memberId);
    }
  });

  test("next action shows the open task's title and due date, and last activity shows relative time", async ({ page }) => {
    let memberId: string | undefined;
    let orgId: string | undefined;
    const orgName = `E2E Columns ${Date.now()}`;

    try {
      const member = await createThrowawayTeamMember("E2E Columns");
      memberId = member.id;
      orgId = await createTestOrganisation(orgName, member.id);
      // A deal logs activity via the deals_log_activity trigger (0007) —
      // gives this org a real, current "last activity" to display.
      await testAdminClient()
        .schema("crm")
        .from("deals")
        .insert({ organisation_id: orgId, title: "E2E deal", stage: "discovery_booked", created_by: member.id });
      await testAdminClient()
        .schema("crm")
        .from("tasks")
        .insert({ organisation_id: orgId, title: "E2E follow-up call", due_at: "2026-12-25", status: "open", created_by: member.id });

      await loginAs(page, member.email, member.password);
      await page.goto("/organisations");

      const row = page.locator("tr", { hasText: orgName });
      await expect(row).toContainText("E2E follow-up call");
      await expect(row).toContainText("25 Dec 2026");
      // "Just now" is the only relative-time string guaranteed not to
      // flake against real clock time in CI.
      await expect(row).toContainText("Just now");
    } finally {
      if (orgId) await deleteOrganisation(orgId);
      if (memberId) await deleteAuthUser(memberId);
    }
  });
});
