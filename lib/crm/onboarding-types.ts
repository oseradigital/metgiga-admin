// Split out from onboarding.ts for the same reason organisation-types.ts
// is split from organisations.ts — lets a client component (the link
// search box) import the shape without pulling in server-only data
// access.
//
// Field grouping below mirrors the Client Portal's own onboarding IA
// exactly (metgiga-portal/lib/onboarding-types.ts and lib/onboarding/stages.ts:
// "Your business" / "Business & team" / "Marketing access" / "Content &
// brand" (which itself covers three screens: brand, discovery,
// production) / Agreement / Final review) — not a re-guessed grouping,
// so Admin's read of a record matches the shape the client actually
// filled in.

export type ClinicLocation = { name: string; address: string };
export type Practitioner = { name: string; role: string };
export type AdAccountStatusRow = {
  platform: string;
  status: "not-requested" | "requested" | "confirmed";
};

export type OnboardingRecord = {
  id: string;
  organisation_id: string | null;
  auth_user_id: string | null;
  access_token: string;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
  expires_at: string;

  // Your business
  business_name: string | null;
  legal_company_name: string | null;
  website: string | null;
  locations: ClinicLocation[];
  contact_role: string | null;
  instagram_handle: string | null;
  tiktok_handle: string | null;
  other_social_channels: string | null;

  // Business & team
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  // Set only after the client actually receives and enters a one-time
  // code sent to this address (metgiga-portal's
  // lib/onboarding/email-verification.ts) — not merely that the domain
  // has mail servers. Resets to false the moment the client edits the
  // email, so this is only ever true for the CURRENT
  // primary_contact_email value, never a stale one.
  contact_email_verified: boolean;
  compliance_contact: string | null;
  practitioners: Practitioner[];
  decision_maker: string | null;
  enquiries_handled_by: string | null;
  content_approver: string | null;
  advertising_approver: string | null;
  urgent_contact: string | null;
  opening_hours: string | null;
  consultation_model: string | null;
  booking_method: string | null;

  // Marketing access
  current_channels: string[] | null;
  monthly_ad_spend_range: string | null;
  monthly_revenue_range: string | null;
  current_agency_or_freelancer: string | null;
  monthly_enquiries: string | null;
  current_show_rate: string | null;
  has_existing_crm: boolean | null;
  existing_crm_name: string | null;
  past_agency_experience: string | null;
  booking_system_name: string | null;

  // Content & brand
  treatment_priorities: string | null;
  brand_guidelines_notes: string | null;
  brand_folder_link: string | null;
  brand_feel: string[] | null;
  brands_admired: string | null;
  style_to_avoid: string | null;

  // Marketing discovery (same stage as content & brand in the portal's IA)
  growth_priority_services: string | null;
  differentiators: string | null;
  common_questions: string | null;
  objections: string | null;
  ideal_client_type: string | null;
  treatments_not_to_promote: string | null;
  ninety_day_goal: string | null;

  // Production
  camera_comfort: string | null;
  who_can_appear: string | null;
  filming_availability: string | null;
  filming_areas: string | null;
  filming_restrictions: string | null;
  filming_suitable_treatments: string | null;
  has_consent_procedures: boolean | null;

  // Agreement
  agreement_status: "not-started" | "sent" | "signed";
  payment_confirmed: boolean;
  kickoff_booked: boolean;

  ad_account_status: AdAccountStatusRow[];

  // Follow-up (migration 0015 / portal 0008): real step progress and a
  // stalled-onboarding signal, replacing the earlier "N of M fields
  // completed" mechanical count. Both null until the client's first
  // save under the new portal code — no backfill for records already
  // in progress (confirmed, accepted gap).
  current_onboarding_step: string | null;
  last_onboarding_activity_at: string | null;
};

export type UnlinkedOnboardingRecord = {
  id: string;
  business_name: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  created_at: string;
};
