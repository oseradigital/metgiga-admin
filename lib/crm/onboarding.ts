import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { OnboardingRecord, UnlinkedOnboardingRecord } from "@/lib/crm/onboarding-types";

// onboarding_records lives in `public` (the Client Portal's schema, not
// crm), reachable here because both apps share one Supabase project —
// no .schema("crm") call, unlike every other lib/crm/*.ts file.
const ONBOARDING_COLUMNS = `
  id, organisation_id, auth_user_id, access_token, created_at, updated_at, revoked_at, expires_at,
  business_name, legal_company_name, website, locations, contact_role, instagram_handle, tiktok_handle, other_social_channels,
  primary_contact_name, primary_contact_email, primary_contact_phone, compliance_contact, practitioners,
  decision_maker, enquiries_handled_by, content_approver, advertising_approver, urgent_contact, opening_hours,
  consultation_model, booking_method,
  current_channels, monthly_ad_spend_range, monthly_revenue_range, current_agency_or_freelancer,
  monthly_enquiries, current_show_rate, has_existing_crm, existing_crm_name, past_agency_experience, booking_system_name,
  treatment_priorities, brand_guidelines_notes, brand_folder_link, brand_feel, brands_admired, style_to_avoid,
  growth_priority_services, differentiators, common_questions, objections, ideal_client_type,
  treatments_not_to_promote, ninety_day_goal,
  camera_comfort, who_can_appear, filming_availability, filming_areas, filming_restrictions,
  filming_suitable_treatments, has_consent_procedures,
  agreement_status, payment_confirmed, kickoff_booked,
  ad_account_status(platform, status)
`;

// At most one per organisation in practice, but nothing in the schema
// enforces that (see migration 0014's comment) — picks the most
// recently updated if more than one is ever linked, rather than
// silently picking an arbitrary one.
export async function getOnboardingRecordForOrganisation(organisationId: string): Promise<OnboardingRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("onboarding_records")
    .select(ONBOARDING_COLUMNS)
    .eq("organisation_id", organisationId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[getOnboardingRecordForOrganisation]", error.message);
    return null;
  }
  return data as unknown as OnboardingRecord | null;
}

// Powers the "link an onboarding record" search on the Onboarding tab —
// only ever searches records not already linked to some other
// organisation, matched by business name or the primary contact's
// email (the two things an admin realistically has on hand when trying
// to find "the onboarding submission for this org").
export async function searchUnlinkedOnboardingRecords(query: string): Promise<UnlinkedOnboardingRecord[]> {
  const q = query.trim();
  if (!q) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("onboarding_records")
    .select("id, business_name, primary_contact_name, primary_contact_email, created_at")
    .is("organisation_id", null)
    .or(`business_name.ilike.%${q}%,primary_contact_email.ilike.%${q}%,primary_contact_name.ilike.%${q}%`)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("[searchUnlinkedOnboardingRecords]", error.message);
    return [];
  }
  return data;
}

// "Completed" mirrors the exact signal the portal itself uses
// (getOnboardingRecordByToken, lib/onboarding/queries.ts): auth_user_id
// is set the moment agreement_status='signed' AND payment_confirmed are
// both true, at which point the portal treats the pre-auth flow as over.
// There's no separate completed_at column — after that point the portal
// makes no further writes to the record (same source), so updated_at is
// an accurate stand-in for "when", not a guess.
export function isOnboardingComplete(record: OnboardingRecord): boolean {
  return Boolean(record.auth_user_id);
}

// A mechanical fields-filled count, not a fabricated "step 3 of 6" — the
// portal doesn't persist a current-step or percentage anywhere, and
// re-deriving one here would mean duplicating its per-step zod
// validation (a real drift risk) just to produce a number that could be
// wrong. This is honest about what it is: how much of the intake form
// has data in it.
const PROGRESS_FIELDS: (keyof OnboardingRecord)[] = [
  "business_name", "legal_company_name", "website", "instagram_handle",
  "primary_contact_name", "primary_contact_email", "primary_contact_phone",
  "decision_maker", "enquiries_handled_by", "opening_hours", "consultation_model", "booking_method",
  "current_channels", "monthly_ad_spend_range", "monthly_revenue_range", "monthly_enquiries",
  "treatment_priorities", "brand_folder_link", "brands_admired",
  "growth_priority_services", "differentiators", "ideal_client_type", "ninety_day_goal",
  "camera_comfort", "who_can_appear",
];

function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function onboardingProgress(record: OnboardingRecord): { filled: number; total: number } {
  const filled = PROGRESS_FIELDS.filter((key) => isFilled(record[key])).length;
  return { filled, total: PROGRESS_FIELDS.length };
}
