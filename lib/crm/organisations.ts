import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Organisation, OrganisationListItem } from "@/lib/crm/organisation-types";

// Types/constants live in organisation-types.ts (no "server-only"), so a
// client component can import those directly without pulling in this
// file's DB access — import from there, not from here, for anything
// that isn't a server-side read.

const ORG_COLUMNS = "id, name, legal_name, website, industry, source, status, created_at";

export async function listOrganisations(): Promise<Organisation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("organisations")
    .select(ORG_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listOrganisations]", error.message);
    return [];
  }
  return data;
}

export async function getOrganisation(id: string): Promise<Organisation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("organisations")
    .select(ORG_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[getOrganisation]", error.message);
    return null;
  }
  return data;
}

// Powers the organisations table: each row needs its primary contact and
// current deal, not just the bare organisation record. Three queries
// fetched in parallel and reduced in JS, not a DB view — the data
// volume for a two-person team's pipeline is a handful of rows per
// table, and this is a page far more likely to need shape changes
// (which column, which "current" deal means) than raw throughput.
export async function listOrganisationsWithSummary(): Promise<OrganisationListItem[]> {
  const supabase = await createClient();

  const [orgsRes, contactsRes, dealsRes, stagesRes] = await Promise.all([
    supabase.schema("crm").from("organisations").select(ORG_COLUMNS).order("created_at", { ascending: false }),
    supabase.schema("crm").from("contacts").select("organisation_id, first_name, last_name, email, is_primary").eq("is_primary", true),
    supabase
      .schema("crm")
      .from("deals")
      .select("id, organisation_id, title, stage, monthly_value, currency, created_at")
      .order("created_at", { ascending: false }),
    supabase.schema("crm").from("deal_stages").select("id, label"),
  ]);

  if (orgsRes.error) {
    console.error("[listOrganisationsWithSummary] organisations", orgsRes.error.message);
    return [];
  }
  if (contactsRes.error) console.error("[listOrganisationsWithSummary] contacts", contactsRes.error.message);
  if (dealsRes.error) console.error("[listOrganisationsWithSummary] deals", dealsRes.error.message);
  if (stagesRes.error) console.error("[listOrganisationsWithSummary] deal_stages", stagesRes.error.message);

  const stageLabels = new Map((stagesRes.data ?? []).map((s) => [s.id, s.label]));

  const primaryContactByOrg = new Map<string, { name: string; email: string | null }>();
  for (const c of contactsRes.data ?? []) {
    if (!primaryContactByOrg.has(c.organisation_id)) {
      const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
      primaryContactByOrg.set(c.organisation_id, { name, email: c.email });
    }
  }

  // deals arrive newest-first, so the first one seen per org is its most
  // recently created — a simple, honest "current deal" definition rather
  // than guessing at priority/urgency (explicitly out of scope for this
  // pass).
  const latestDealByOrg = new Map<string, NonNullable<typeof dealsRes.data>[number]>();
  for (const d of dealsRes.data ?? []) {
    if (!latestDealByOrg.has(d.organisation_id)) latestDealByOrg.set(d.organisation_id, d);
  }

  return orgsRes.data.map((org) => {
    const contact = primaryContactByOrg.get(org.id);
    const deal = latestDealByOrg.get(org.id);
    return {
      ...org,
      primaryContactName: contact?.name || null,
      primaryContactEmail: contact?.email ?? null,
      activeDeal: deal
        ? {
            id: deal.id,
            title: deal.title,
            stage: deal.stage,
            stageLabel: stageLabels.get(deal.stage) ?? deal.stage,
            monthlyValue: deal.monthly_value,
            currency: deal.currency,
          }
        : null,
    };
  });
}
