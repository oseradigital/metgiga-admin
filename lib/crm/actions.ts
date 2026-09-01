"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveTeamMember } from "@/lib/supabase/team";
import { ORGANISATION_STATUSES, type OrganisationStatus } from "@/lib/crm/organisation-types";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

// Every mutation here re-checks membership itself rather than trusting
// that only a protected page could have called it — Server Actions are
// public HTTP endpoints in their own right (callable directly, not just
// from the page that renders a form for them), so the (app) layout's
// gate doesn't cover them. RLS is still the real enforcement (a bug here
// can't grant access the database wouldn't also allow) — this is the
// second, cheaper check that turns "RLS silently returns nothing" into
// an actual explained error.
async function requireTeamMember() {
  const member = await getActiveTeamMember();
  if (!member) throw new Error("Not signed in.");
  return member;
}

export async function createOrganisation(input: {
  name: string;
  legalName?: string;
  website?: string;
  industry?: string;
}): Promise<ActionResult<{ id: string }>> {
  await requireTeamMember();

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Enter an organisation name." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("organisations")
    .insert({
      name,
      legal_name: emptyToNull(input.legalName),
      website: emptyToNull(input.website),
      industry: emptyToNull(input.industry),
      // created_by defaults to auth.uid() in the DB — not set here, so a
      // caller can never claim someone else's id (see 0007's `with check`).
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createOrganisation]", error.message);
    return { ok: false, error: "Couldn't create this organisation. Try again." };
  }

  revalidatePath("/organisations");
  return { ok: true, data: { id: data.id } };
}

export async function updateOrganisation(
  id: string,
  input: {
    name: string;
    legalName?: string;
    website?: string;
    industry?: string;
    status: OrganisationStatus;
  },
): Promise<ActionResult> {
  await requireTeamMember();

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Enter an organisation name." };
  if (!ORGANISATION_STATUSES.includes(input.status)) {
    return { ok: false, error: "Invalid status." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .schema("crm")
    .from("organisations")
    .update({
      name,
      legal_name: emptyToNull(input.legalName),
      website: emptyToNull(input.website),
      industry: emptyToNull(input.industry),
      status: input.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("[updateOrganisation]", error.message);
    return { ok: false, error: "Couldn't save these changes. Try again." };
  }

  revalidatePath("/organisations");
  revalidatePath(`/organisations/${id}`);
  return { ok: true };
}

export async function createContact(
  organisationId: string,
  input: { firstName: string; lastName?: string; email?: string; phone?: string; role?: string; isPrimary?: boolean },
): Promise<ActionResult<{ id: string }>> {
  await requireTeamMember();

  const firstName = input.firstName.trim();
  if (!firstName) return { ok: false, error: "Enter a first name." };

  const supabase = await createClient();

  // is_primary is a plain boolean column, not a partial unique index —
  // enforcing "only one primary contact" is done here, not left to
  // chance. Not fully race-proof under concurrent writes (two people
  // clicking "add as primary" in the same instant), which is an
  // acceptable gap for a two-person internal tool; worth a real
  // constraint if this ever needs to hold under real concurrency.
  if (input.isPrimary) {
    await supabase
      .schema("crm")
      .from("contacts")
      .update({ is_primary: false })
      .eq("organisation_id", organisationId);
  }

  const { data, error } = await supabase
    .schema("crm")
    .from("contacts")
    .insert({
      organisation_id: organisationId,
      first_name: firstName,
      last_name: emptyToNull(input.lastName),
      email: emptyToNull(input.email),
      phone: emptyToNull(input.phone),
      role: emptyToNull(input.role),
      is_primary: Boolean(input.isPrimary),
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createContact]", error.message);
    return { ok: false, error: "Couldn't add this contact. Try again." };
  }

  revalidatePath(`/organisations/${organisationId}`);
  return { ok: true, data: { id: data.id } };
}

export async function setPrimaryContact(organisationId: string, contactId: string): Promise<ActionResult> {
  await requireTeamMember();

  const supabase = await createClient();
  const { error: clearError } = await supabase
    .schema("crm")
    .from("contacts")
    .update({ is_primary: false })
    .eq("organisation_id", organisationId);
  if (clearError) {
    console.error("[setPrimaryContact:clear]", clearError.message);
    return { ok: false, error: "Couldn't update the primary contact. Try again." };
  }

  const { error: setError } = await supabase
    .schema("crm")
    .from("contacts")
    .update({ is_primary: true })
    .eq("id", contactId);
  if (setError) {
    console.error("[setPrimaryContact:set]", setError.message);
    return { ok: false, error: "Couldn't update the primary contact. Try again." };
  }

  revalidatePath(`/organisations/${organisationId}`);
  return { ok: true };
}

export async function createDeal(input: {
  organisationId: string;
  primaryContactId?: string;
  title: string;
  stage: string;
  package?: string;
  monthlyValue?: string;
  expectedStartDate?: string;
  ownerUserId?: string;
  source?: string;
}): Promise<ActionResult<{ id: string }>> {
  await requireTeamMember();

  const title = input.title.trim();
  if (!title) return { ok: false, error: "Enter a deal title." };
  if (!input.organisationId) return { ok: false, error: "Choose an organisation." };
  if (!input.stage) return { ok: false, error: "Choose a stage." };

  const monthlyValue = input.monthlyValue?.trim() ? Number(input.monthlyValue) : null;
  if (monthlyValue !== null && (!Number.isFinite(monthlyValue) || monthlyValue < 0)) {
    return { ok: false, error: "Enter a valid monthly value." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("deals")
    .insert({
      organisation_id: input.organisationId,
      primary_contact_id: input.primaryContactId || null,
      title,
      stage: input.stage,
      package: emptyToNull(input.package),
      monthly_value: monthlyValue,
      expected_start_date: input.expectedStartDate?.trim() || null,
      owner_user_id: input.ownerUserId || null,
      source: emptyToNull(input.source),
    })
    .select("id")
    .single();
  // deal.created is logged automatically by the deals_log_activity
  // trigger (0007) — not duplicated here.

  if (error) {
    console.error("[createDeal]", error.message);
    return { ok: false, error: "Couldn't create this deal. Try again." };
  }

  revalidatePath("/deals");
  revalidatePath(`/organisations/${input.organisationId}`);
  return { ok: true, data: { id: data.id } };
}

export async function updateDeal(
  id: string,
  input: {
    title: string;
    stage: string;
    package?: string;
    monthlyValue?: string;
    expectedStartDate?: string;
    ownerUserId?: string;
    source?: string;
    nextAction?: string;
    lostReason?: string;
  },
): Promise<ActionResult> {
  await requireTeamMember();

  const title = input.title.trim();
  if (!title) return { ok: false, error: "Enter a deal title." };
  if (!input.stage) return { ok: false, error: "Choose a stage." };

  const monthlyValue = input.monthlyValue?.trim() ? Number(input.monthlyValue) : null;
  if (monthlyValue !== null && (!Number.isFinite(monthlyValue) || monthlyValue < 0)) {
    return { ok: false, error: "Enter a valid monthly value." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("deals")
    .update({
      title,
      stage: input.stage,
      package: emptyToNull(input.package),
      monthly_value: monthlyValue,
      expected_start_date: input.expectedStartDate?.trim() || null,
      owner_user_id: input.ownerUserId || null,
      source: emptyToNull(input.source),
      next_action: emptyToNull(input.nextAction),
      lost_reason: emptyToNull(input.lostReason),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("organisation_id")
    .single();
  // A stage change is logged automatically by the same trigger, whether
  // it changed on this call or not (the trigger checks old vs new
  // itself) — this action doesn't need to know or care which happened.

  if (error) {
    console.error("[updateDeal]", error.message);
    return { ok: false, error: "Couldn't save these changes. Try again." };
  }

  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
  if (data?.organisation_id) revalidatePath(`/organisations/${data.organisation_id}`);
  return { ok: true };
}

// A lighter-weight sibling to updateDeal, for the pipeline board's
// quick per-card stage select — doesn't require re-sending every other
// field just to change one.
export async function changeDealStage(id: string, stage: string): Promise<ActionResult> {
  await requireTeamMember();
  if (!stage) return { ok: false, error: "Choose a stage." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("deals")
    .update({ stage, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("organisation_id")
    .single();

  if (error) {
    console.error("[changeDealStage]", error.message);
    return { ok: false, error: "Couldn't move this deal. Try again." };
  }

  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
  if (data?.organisation_id) revalidatePath(`/organisations/${data.organisation_id}`);
  return { ok: true };
}

export async function addNote(
  entityType: "deal" | "organisation",
  entityId: string,
  text: string,
  organisationId: string,
): Promise<ActionResult> {
  await requireTeamMember();

  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Enter a note." };

  const supabase = await createClient();
  const { error } = await supabase
    .schema("crm")
    .from("activity_events")
    .insert({
      organisation_id: organisationId,
      event_type: "note.added",
      entity_type: entityType,
      entity_id: entityId,
      metadata: { text: trimmed },
      // actor_id defaults to auth.uid() — see 0007's insert policy,
      // which also rejects any attempt to claim a different actor.
    });

  if (error) {
    console.error("[addNote]", error.message);
    return { ok: false, error: "Couldn't add this note. Try again." };
  }

  if (entityType === "deal") revalidatePath(`/deals/${entityId}`);
  return { ok: true };
}

export async function createTask(input: {
  title: string;
  description?: string;
  dueAt?: string;
  priority?: string;
  assignedTo?: string;
  organisationId?: string;
  dealId?: string;
}): Promise<ActionResult<{ id: string }>> {
  await requireTeamMember();

  const title = input.title.trim();
  if (!title) return { ok: false, error: "Enter a task title." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("tasks")
    .insert({
      title,
      description: emptyToNull(input.description),
      due_at: input.dueAt?.trim() || null,
      priority: input.priority || "normal",
      assigned_to: input.assignedTo || null,
      organisation_id: input.organisationId || null,
      deal_id: input.dealId || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createTask]", error.message);
    return { ok: false, error: "Couldn't create this task. Try again." };
  }

  revalidatePath("/tasks");
  if (input.dealId) revalidatePath(`/deals/${input.dealId}`);
  return { ok: true, data: { id: data.id } };
}

export async function setTaskStatus(id: string, status: "open" | "done"): Promise<ActionResult> {
  await requireTeamMember();

  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("crm")
    .from("tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("deal_id")
    .single();

  if (error) {
    console.error("[setTaskStatus]", error.message);
    return { ok: false, error: "Couldn't update this task. Try again." };
  }

  revalidatePath("/tasks");
  if (data?.deal_id) revalidatePath(`/deals/${data.deal_id}`);
  return { ok: true };
}
