import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ActivityEvent } from "@/lib/crm/deal-types";

const ACTIVITY_SELECT =
  "id, actor_id, event_type, metadata, created_at, actor:team_members!actor_id(full_name)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapActivity(row: any): ActivityEvent {
  return {
    id: row.id,
    actor_id: row.actor_id,
    actor_name: row.actor?.full_name ?? null,
    event_type: row.event_type,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: row.created_at,
  };
}

export async function listActivity(entityType: string, entityId: string): Promise<ActivityEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("activity_events")
    .select(ACTIVITY_SELECT)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listActivity]", error.message);
    return [];
  }
  return data.map(mapActivity);
}

// The organisation's own Activity tab — deliberately queries by the
// denormalised organisation_id column rather than entity_type/entity_id,
// so it naturally aggregates everything tied to this org: its own notes
// AND every stage change/note on every deal that belongs to it. That
// denormalisation (0007) exists specifically to make this query cheap.
export async function listActivityForOrganisation(organisationId: string): Promise<ActivityEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("activity_events")
    .select(ACTIVITY_SELECT)
    .eq("organisation_id", organisationId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listActivityForOrganisation]", error.message);
    return [];
  }
  return data.map(mapActivity);
}
