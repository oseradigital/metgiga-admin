import type { ClinicLocation, Practitioner } from "@/lib/crm/onboarding-types";

const ENUM_LABELS: Record<string, Record<string, string>> = {
  monthly_ad_spend_range: {
    none: "None",
    "under-1k": "Under £1k/mo",
    "1k-3k": "£1k–£3k/mo",
    "3k-10k": "£3k–£10k/mo",
    "10k-plus": "£10k+/mo",
  },
  monthly_revenue_range: {
    "under-10k": "Under £10k/mo",
    "10k-20k": "£10k–£20k/mo",
    "20k-50k": "£20k–£50k/mo",
    "50k-plus": "£50k+/mo",
    "prefer-not-to-say": "Prefer not to say",
  },
  camera_comfort: {
    "very-comfortable": "Very comfortable",
    comfortable: "Comfortable",
    "somewhat-uncomfortable": "Somewhat uncomfortable",
    "prefer-not-to": "Prefer not to",
  },
  agreement_status: {
    "not-started": "Not started",
    sent: "Sent",
    signed: "Signed",
  },
  ad_account_platform: {
    meta: "Meta",
    google_ads: "Google Ads",
    google_analytics: "Google Analytics",
    google_business_profile: "Google Business Profile",
    booking_system: "Booking system",
    crm: "CRM",
    other: "Other",
  },
  ad_account_status: {
    "not-requested": "Not requested",
    requested: "Requested",
    confirmed: "Confirmed",
  },
};

export function enumLabel(group: keyof typeof ENUM_LABELS, value: string | null): string {
  if (!value) return "—";
  return ENUM_LABELS[group]?.[value] ?? value;
}

export function formatLocations(locations: ClinicLocation[] | null): string {
  if (!locations || locations.length === 0) return "—";
  return locations.map((l) => (l.address ? `${l.name} (${l.address})` : l.name)).join("; ");
}

export function formatPractitioners(practitioners: Practitioner[] | null): string {
  if (!practitioners || practitioners.length === 0) return "—";
  return practitioners.map((p) => (p.role ? `${p.name} — ${p.role}` : p.name)).join("; ");
}

export function formatList(values: string[] | null): string {
  if (!values || values.length === 0) return "—";
  return values.join(", ");
}

export function formatBoolean(value: boolean | null): string {
  if (value === null) return "—";
  return value ? "Yes" : "No";
}

export function formatText(value: string | null): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}
