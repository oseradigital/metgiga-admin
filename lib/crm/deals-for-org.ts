import "server-only";
import { createClient } from "@/lib/supabase/server";

export type OrgDealSummary = { id: string; title: string; stage: string; stage_label: string; monthly_value: number | null };

export async function listDealsForOrganisation(organisationId: string): Promise<OrgDealSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("deals")
    .select("id, title, stage, monthly_value, deal_stages!stage(label)")
    .eq("organisation_id", organisationId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listDealsForOrganisation]", error.message);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    stage: row.stage,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stage_label: (row.deal_stages as any)?.label ?? row.stage,
    monthly_value: row.monthly_value,
  }));
}
