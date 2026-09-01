import { test, expect } from "@playwright/test";
import { createThrowawayTeamMember, createTestOrganisation, createTestDeal, deleteOrganisation, deleteAuthUser, loginAs } from "./helpers";

test.describe("Pipeline stage moves", () => {
  test("moving a deal on the board updates it and logs the move on its timeline", async ({ page }) => {
    let memberId: string | undefined;
    let orgId: string | undefined;

    try {
      const member = await createThrowawayTeamMember("E2E Pipeline Mover");
      memberId = member.id;
      orgId = await createTestOrganisation("E2E Pipeline Org", member.id);
      const dealTitle = `E2E Pipeline Deal ${Date.now()}`;
      const dealId = await createTestDeal(orgId, dealTitle, "discovery_booked", member.id);

      await loginAs(page, member.email, member.password);
      await page.goto("/deals");

      const card = page.locator("a", { hasText: dealTitle });
      await expect(card).toBeVisible();
      await card.locator("select").selectOption("proposal");
      // The select's onChange saves, then calls router.refresh() — wait
      // for the DOM to actually reflect the new value rather than
      // assuming the interaction alone was enough.
      await expect(card.locator("select")).toHaveValue("proposal");

      await page.goto(`/deals/${dealId}`);
      await expect(page.getByText("Proposal", { exact: true })).toBeVisible();
      await expect(page.getByText(/moved this deal from Discovery Booked to Proposal/)).toBeVisible();
    } finally {
      // Cascades deals/tasks/activity_events for this org (0007's FKs).
      if (orgId) await deleteOrganisation(orgId);
      if (memberId) await deleteAuthUser(memberId);
    }
  });

  test("a deal reaching Deal Won or Lost is reflected on its own detail page", async ({ page }) => {
    let memberId: string | undefined;
    let orgId: string | undefined;

    try {
      const member = await createThrowawayTeamMember("E2E Pipeline Won");
      memberId = member.id;
      orgId = await createTestOrganisation("E2E Pipeline Won Org", member.id);
      const dealTitle = `E2E Won Deal ${Date.now()}`;
      const dealId = await createTestDeal(orgId, dealTitle, "payment_completed", member.id);

      await loginAs(page, member.email, member.password);
      await page.goto("/deals");

      const card = page.locator("a", { hasText: dealTitle });
      await card.locator("select").selectOption("deal_won");
      await expect(card.locator("select")).toHaveValue("deal_won");

      await page.goto(`/deals/${dealId}`);
      await expect(page.getByText("Deal Won", { exact: true })).toBeVisible();
    } finally {
      if (orgId) await deleteOrganisation(orgId);
      if (memberId) await deleteAuthUser(memberId);
    }
  });
});
