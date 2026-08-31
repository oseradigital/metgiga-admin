import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ActivityEvent } from "@/lib/crm/deal-types";

export async function listActivity(entityType: string, entityId: string): Promise<ActivityEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("activity_events")
    .select("id, actor_id, event_type, metadata, created_at, actor:team_members!actor_id(full_name)")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listActivity]", error.message);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    actor_id: row.actor_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actor_name: (row.actor as any)?.full_name ?? null,
    event_type: row.event_type,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: row.created_at,
  }));
}
