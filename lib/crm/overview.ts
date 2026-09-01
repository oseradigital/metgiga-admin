import "server-only";
import { createClient } from "@/lib/supabase/server";

// The one stated, literal threshold behind "needs attention" — not a
// vague heuristic. An organisation qualifies if it has no next action
// at all, OR its last activity is older than this many days (or has
// none ever). Both conditions are checked directly against real rows
// (crm.tasks, crm.activity_events), nothing inferred about priority.
export const NEEDS_ATTENTION_DAYS = 14;

export type PipelineStageSummary = {
  id: string;
  label: string;
  sortOrder: number;
  isWon: boolean;
  isLost: boolean;
  count: number;
  value: number;
};

// Every stage shown, including empty ones and the won/lost terminals —
// literally what's in the pipeline, not a curated subset.
export async function getPipelineByStage(): Promise<PipelineStageSummary[]> {
  const supabase = await createClient();
  const [stagesRes, dealsRes] = await Promise.all([
    supabase.schema("crm").from("deal_stages").select("id, label, sort_order, is_won, is_lost").order("sort_order"),
    supabase.schema("crm").from("deals").select("stage, monthly_value"),
  ]);

  if (stagesRes.error) {
    console.error("[getPipelineByStage] deal_stages", stagesRes.error.message);
    return [];
  }
  if (dealsRes.error) console.error("[getPipelineByStage] deals", dealsRes.error.message);

  const byStage = new Map<string, { count: number; value: number }>();
  for (const d of dealsRes.data ?? []) {
    const entry = byStage.get(d.stage) ?? { count: 0, value: 0 };
    entry.count += 1;
    entry.value += d.monthly_value ?? 0;
    byStage.set(d.stage, entry);
  }

  return stagesRes.data.map((s) => ({
    id: s.id,
    label: s.label,
    sortOrder: s.sort_order,
    isWon: s.is_won,
    isLost: s.is_lost,
    count: byStage.get(s.id)?.count ?? 0,
    value: byStage.get(s.id)?.value ?? 0,
  }));
}

export type MyTaskCounts = { dueToday: number; overdue: number };

// "My" = assigned_to the current signed-in member — literal counts of
// open tasks, no scoring.
export async function getMyTaskCounts(memberId: string): Promise<MyTaskCounts> {
  const supabase = await createClient();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 86_400_000);

  const [dueTodayRes, overdueRes] = await Promise.all([
    supabase
      .schema("crm")
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", memberId)
      .eq("status", "open")
      .gte("due_at", startOfToday.toISOString())
      .lt("due_at", startOfTomorrow.toISOString()),
    supabase
      .schema("crm")
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", memberId)
      .eq("status", "open")
      .lt("due_at", startOfToday.toISOString()),
  ]);

  if (dueTodayRes.error) console.error("[getMyTaskCounts] dueToday", dueTodayRes.error.message);
  if (overdueRes.error) console.error("[getMyTaskCounts] overdue", overdueRes.error.message);

  return { dueToday: dueTodayRes.count ?? 0, overdue: overdueRes.count ?? 0 };
}

export type RecentActivityItem = {
  id: string;
  organisationId: string | null;
  organisationName: string | null;
  actorName: string | null;
  eventType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export async function listRecentActivity(limit = 10): Promise<RecentActivityItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("activity_events")
    .select(
      "id, organisation_id, event_type, metadata, created_at, actor:team_members!actor_id(full_name), organisations!organisation_id(name)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[listRecentActivity]", error.message);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    organisationId: row.organisation_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    organisationName: (row.organisations as any)?.name ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actorName: (row.actor as any)?.full_name ?? null,
    eventType: row.event_type,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at,
  }));
}
