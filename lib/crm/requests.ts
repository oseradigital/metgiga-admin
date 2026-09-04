import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ClientRequest } from "@/lib/crm/request-types";

const REQUEST_SELECT =
  "id, organisation_id, subject, message, status, response, responded_at, created_at, organisations!organisation_id(name)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRequest(row: any): ClientRequest {
  return {
    id: row.id,
    organisation_id: row.organisation_id,
    organisation_name: row.organisations?.name ?? null,
    subject: row.subject,
    message: row.message,
    status: row.status,
    response: row.response,
    responded_at: row.responded_at,
    created_at: row.created_at,
  };
}

// Open first, then in_progress, then resolved — same "unresolved work
// first" ordering listTasks already uses (see its own comment on why
// status can't just sort alphabetically), newest first within each.
export async function listClientRequests(): Promise<ClientRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("client_requests")
    .select(REQUEST_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listClientRequests]", error.message);
    return [];
  }

  const rows = (data ?? []).map(mapRequest);
  const rank: Record<string, number> = { open: 0, in_progress: 1, resolved: 2 };
  return rows.sort((a, b) => rank[a.status] - rank[b.status]);
}

export async function listClientRequestsForOrganisation(organisationId: string): Promise<ClientRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("client_requests")
    .select(REQUEST_SELECT)
    .eq("organisation_id", organisationId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listClientRequestsForOrganisation]", error.message);
    return [];
  }
  return (data ?? []).map(mapRequest);
}
