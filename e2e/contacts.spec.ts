import { test, expect } from "@playwright/test";
import {
  createThrowawayTeamMember,
  createTestOrganisation,
  deleteOrganisation,
  deleteAuthUser,
  loginAs,
  testAdminClient,
} from "./helpers";

test.describe("Primary contact integrity", () => {
  test("the exact scenario: create Sarah, mark primary, create John, mark primary — Sarah is automatically un-primaried", async ({
    page,
  }) => {
    let memberId: string | undefined;
    let orgId: string | undefined;
    const orgName = `E2E Primary Contact ${Date.now()}`;

    try {
      const member = await createThrowawayTeamMember("E2E Primary Contact");
      memberId = member.id;
      orgId = await createTestOrganisation(orgName, member.id);

      await loginAs(page, member.email, member.password);
      await page.goto(`/organisations/${orgId}?tab=contacts`);

      // First contact on an org defaults to primary (ContactsPanel) — no
      // explicit "mark primary" step needed for Sarah specifically,
      // matching the real UI (there's no primary checkbox on the add
      // form at all; primary status is either automatic-for-the-first
      // or set afterward via "Set as primary").
      await page.getByRole("button", { name: "Add contact" }).click();
      await page.getByLabel("First name").fill("Sarah");
      await page.getByRole("button", { name: "Add contact" }).click();
      await expect(page.getByText("Sarah")).toBeVisible();
      await expect(page.getByText("Primary", { exact: true })).toBeVisible();

      await page.getByRole("button", { name: "Add contact" }).click();
      await page.getByLabel("First name").fill("John");
      await page.getByRole("button", { name: "Add contact" }).click();
      await expect(page.getByText("John")).toBeVisible();

      await page.getByRole("button", { name: "Set as primary" }).click();
      // Confirmed against the database, not just the UI re-rendering —
      // the UI could show the right thing while the write underneath
      // failed or only half-applied.
      await expect
        .poll(async () => {
          const { data } = await testAdminClient()
            .schema("crm")
            .from("contacts")
            .select("first_name, is_primary")
            .eq("organisation_id", orgId);
          return data?.find((c) => c.first_name === "Sarah")?.is_primary;
        })
        .toBe(false);

      const { data: contacts } = await testAdminClient()
        .schema("crm")
        .from("contacts")
        .select("first_name, is_primary")
        .eq("organisation_id", orgId);
      expect(contacts?.find((c) => c.first_name === "John")?.is_primary).toBe(true);
      // The actual invariant: never both, never neither.
      expect(contacts?.filter((c) => c.is_primary).length).toBe(1);
    } finally {
      if (orgId) await deleteOrganisation(orgId);
      if (memberId) await deleteAuthUser(memberId);
    }
  });

  test("the database itself refuses two primary contacts on one organisation, even bypassing the app", async () => {
    // Not a UI test — proves the actual guarantee (the partial unique
    // index from migration 0013), independent of whether the app's own
    // clear-then-set logic in lib/crm/actions.ts stays correct. Uses the
    // admin client to insert directly, skipping the app's clear step
    // entirely, exactly like a bug or a race condition would.
    let memberId: string | undefined;
    let orgId: string | undefined;

    try {
      const member = await createThrowawayTeamMember("E2E DB Constraint");
      memberId = member.id;
      orgId = await createTestOrganisation(`E2E DB Constraint Org ${Date.now()}`, member.id);

      const { error: firstError } = await testAdminClient()
        .schema("crm")
        .from("contacts")
        .insert({ organisation_id: orgId, first_name: "Sarah", is_primary: true, created_by: member.id });
      expect(firstError).toBeNull();

      const { error: secondError } = await testAdminClient()
        .schema("crm")
        .from("contacts")
        .insert({ organisation_id: orgId, first_name: "John", is_primary: true, created_by: member.id });
      expect(secondError).not.toBeNull();
      expect(secondError?.code).toBe("23505"); // unique_violation
      expect(secondError?.message).toContain("contacts_one_primary_per_org");
    } finally {
      if (orgId) await deleteOrganisation(orgId);
      if (memberId) await deleteAuthUser(memberId);
    }
  });
});
