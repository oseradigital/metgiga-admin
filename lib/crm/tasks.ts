import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Task } from "@/lib/crm/task-types";

const TASK_SELECT =
  "id, organisation_id, deal_id, assigned_to, title, description, due_at, status, priority, created_at, organisations!organisation_id(name), deals!deal_id(title), assignee:team_members!assigned_to(full_name)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTask(row: any): Task {
  return {
    id: row.id,
    organisation_id: row.organisation_id,
    organisation_name: row.organisations?.name ?? null,
    deal_id: row.deal_id,
    deal_title: row.deals?.title ?? null,
    assigned_to: row.assigned_to,
    assignee_name: row.assignee?.full_name ?? null,
    title: row.title,
    description: row.description,
    due_at: row.due_at,
    status: row.status,
    priority: row.priority,
    created_at: row.created_at,
  };
}

export async function listTasks(): Promise<Task[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("tasks")
    .select(TASK_SELECT)
    .order("status", { ascending: true }) // "done" < "open" alphabetically is wrong; handled by sortTasks below instead
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listTasks]", error.message);
    return [];
  }
  return sortTasks(data.map(mapTask));
}

// Covers both organisation-level tasks and deal-scoped tasks belonging
// to this organisation — createTask() always sets organisation_id
// alongside deal_id for a deal-scoped task (see DealTasksPanel), so
// filtering on organisation_id alone naturally captures both without
// needing a separate "OR deal.organisation_id = X" join.
export async function listTasksForOrganisation(organisationId: string): Promise<Task[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("tasks")
    .select(TASK_SELECT)
    .eq("organisation_id", organisationId)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listTasksForOrganisation]", error.message);
    return [];
  }
  return sortTasks(data.map(mapTask));
}

export async function listTasksForDeal(dealId: string): Promise<Task[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("tasks")
    .select(TASK_SELECT)
    .eq("deal_id", dealId)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listTasksForDeal]", error.message);
    return [];
  }
  return sortTasks(data.map(mapTask));
}

// Open tasks first (soonest due date first, no-due-date last), done
// tasks after — the DB-level status ordering above sorts "done"/"open"
// alphabetically, which is the wrong order, so it's corrected here
// rather than relying on collation.
function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    return 0; // already ordered by due_at/created_at from the query
  });
}
