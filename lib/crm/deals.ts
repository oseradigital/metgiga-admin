import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Deal, DealStage } from "@/lib/crm/deal-types";

export async function listDealStages(): Promise<DealStage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("deal_stages")
    .select("id, label, sort_order, is_won, is_lost")
    .order("sort_order");

  if (error) {
    console.error("[listDealStages]", error.message);
    return [];
  }
  return data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDeal(row: any): Deal {
  return {
    id: row.id,
    organisation_id: row.organisation_id,
    organisation_name: row.organisations?.name ?? "—",
    primary_contact_id: row.primary_contact_id,
    title: row.title,
    stage: row.stage,
    package: row.package,
    monthly_value: row.monthly_value,
    currency: row.currency,
    expected_start_date: row.expected_start_date,
    owner_user_id: row.owner_user_id,
    owner_name: row.owner?.full_name ?? null,
    source: row.source,
    next_action: row.next_action,
    lost_reason: row.lost_reason,
    created_at: row.created_at,
  };
}

const DEAL_SELECT =
  "id, organisation_id, primary_contact_id, title, stage, package, monthly_value, currency, expected_start_date, owner_user_id, source, next_action, lost_reason, created_at, organisations!organisation_id(name), owner:team_members!owner_user_id(full_name)";

export async function listDeals(): Promise<Deal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("deals")
    .select(DEAL_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listDeals]", error.message);
    return [];
  }
  return data.map(mapDeal);
}

export async function getDeal(id: string): Promise<Deal | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("deals")
    .select(DEAL_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[getDeal]", error.message);
    return null;
  }
  return data ? mapDeal(data) : null;
}
