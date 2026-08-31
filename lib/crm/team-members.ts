import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TeamMemberOption } from "@/lib/crm/deal-types";

export type { TeamMemberOption };

// Distinct from lib/supabase/team.ts's getActiveTeamMember(), which is
// about the CURRENT signed-in caller's own membership/auth gate — this
// lists the whole (two-person, for now) team, for assignment dropdowns
// (deal owner, task assignee later).
export async function listTeamMembers(): Promise<TeamMemberOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("team_members")
    .select("id, full_name")
    .eq("is_active", true)
    .order("full_name");

  if (error) {
    console.error("[listTeamMembers]", error.message);
    return [];
  }
  return data;
}
