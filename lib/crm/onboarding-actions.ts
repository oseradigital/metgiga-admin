"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveTeamMember } from "@/lib/supabase/team";
import { searchUnlinkedOnboardingRecords } from "@/lib/crm/onboarding";
import type { ActionResult } from "@/lib/crm/actions";
import type { UnlinkedOnboardingRecord } from "@/lib/crm/onboarding-types";

async function requireTeamMember() {
  const member = await getActiveTeamMember();
  if (!member) throw new Error("Not signed in.");
  return member;
}

// Thin Server Action wrapper so the client-side link search box (a "use
// client" component) can call the server-only searchUnlinkedOnboardingRecords
// without an API route.
export async function searchUnlinkedOnboardingRecordsAction(query: string): Promise<UnlinkedOnboardingRecord[]> {
  await requireTeamMember();
  return searchUnlinkedOnboardingRecords(query);
}

// Calls public.link_onboarding_record_to_organisation (migration 0014) —
// deliberately not a direct table update. See that migration's comment:
// a raw column grant would also technically hand write access to the
// client the record belongs to, which this RPC avoids entirely.
export async function linkOnboardingRecord(organisationId: string, onboardingRecordId: string): Promise<ActionResult> {
  await requireTeamMember();

  const supabase = await createClient();
  const { error } = await supabase.rpc("link_onboarding_record_to_organisation", {
    onboarding_id: onboardingRecordId,
    org_id: organisationId,
  });

  if (error) {
    console.error("[linkOnboardingRecord]", error.message);
    return { ok: false, error: "Couldn't link that onboarding record. Try again." };
  }

  revalidatePath(`/organisations/${organisationId}`);
  return { ok: true };
}
