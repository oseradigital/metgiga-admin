import Link from "next/link";
import type { OnboardingRecord } from "@/lib/crm/onboarding-types";
import { isOnboardingComplete, isOnboardingStalled, onboardingProgress, ONBOARDING_STALL_DAYS } from "@/lib/crm/onboarding";
import { enumLabel, formatBoolean, formatList, formatLocations, formatPractitioners, formatText } from "@/lib/crm/onboarding-format";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { LinkOnboardingSearch } from "@/components/crm/LinkOnboardingSearch";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-grey-on-light font-medium mb-1">{label}</dt>
      <dd className="text-midnight break-words">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-bone rounded-xl border border-midnight/10 p-5">
      <h3 className="font-display text-lg mb-4">{title}</h3>
      <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">{children}</dl>
    </div>
  );
}

// Section titles below match metgiga-portal/lib/onboarding/stages.ts's
// ONBOARDING_STAGES exactly ("Your clinic" / "Business & team" /
// "Marketing access" / "Content & brand") — checked against that file
// directly, not re-derived from field names. Agreement/Final review
// aren't separate sections here: Agreement's three fields
// (agreement_status/payment_confirmed/kickoff_booked) are shown in the
// status bar above instead, and Final review has no fields of its own
// in the portal (it's a read-only summary screen over everything else).
// Production is its own subsection WITHIN Content & brand, not a
// sixth top-level section — the portal's own IA nests
// ContentBrand/MarketingDiscovery/ProductionInfo together under that
// one stage (see the comment on ContentBrand in onboarding-types.ts).

// Read-only by design — every field here is either client-submitted (the
// client owns editing it, from their own portal) or system-controlled
// (agreement_status/payment_confirmed/kickoff_booked, writable only by
// the service role per metgiga-portal's migration 0001). Admin's only
// write access to this record at all is the organisation_id link
// itself (lib/crm/onboarding-actions.ts).
export function OnboardingPanel({ organisationId, record }: { organisationId: string; record: OnboardingRecord | null }) {
  if (!record) {
    return <LinkOnboardingSearch organisationId={organisationId} />;
  }

  const complete = isOnboardingComplete(record);
  const stalled = isOnboardingStalled(record);
  const { filled, total } = onboardingProgress(record);

  return (
    <div className="space-y-4">
      <div className="bg-bone rounded-xl border border-midnight/10 p-5">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Badge tone={complete ? "success" : "copper"}>{complete ? "Completed" : "In progress"}</Badge>
          {stalled ? (
            // Not Badge's own "copper" tone — that's already used for
            // "In progress" just above, and the two badges next to each
            // other would read as the same severity. This is a warning,
            // not a routine status, so it gets the error colour instead.
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium tracking-wide bg-error/10 text-error">
              Stalled — no activity in {ONBOARDING_STALL_DAYS}+ days
            </span>
          ) : null}
          <span className="text-sm text-grey-on-light">{filled} of {total} fields completed</span>
        </div>
        <dl className="grid sm:grid-cols-3 gap-x-8 gap-y-3 text-sm">
          <Field label="Started" value={formatDate(record.created_at)} />
          <Field label={complete ? "Completed on" : "Last updated"} value={formatDate(record.updated_at)} />
          <Field
            label="Currently on"
            value={record.current_onboarding_step ?? "Not started yet"}
          />
          <Field
            label="Client last active"
            value={record.last_onboarding_activity_at ? formatRelativeTime(record.last_onboarding_activity_at) : "—"}
          />
          <Field label="Agreement" value={enumLabel("agreement_status", record.agreement_status)} />
          <Field label="Payment confirmed" value={formatBoolean(record.payment_confirmed)} />
          <Field label="Kickoff booked" value={formatBoolean(record.kickoff_booked)} />
        </dl>
      </div>

      <Section title="Your clinic">
        <Field label="Business name" value={formatText(record.business_name)} />
        <Field label="Legal company name" value={formatText(record.legal_company_name)} />
        <Field label="Website" value={formatText(record.website)} />
        <Field label="Locations" value={formatLocations(record.locations)} />
        <Field label="Instagram" value={formatText(record.instagram_handle)} />
        <Field label="TikTok" value={formatText(record.tiktok_handle)} />
        <Field label="Other social channels" value={formatText(record.other_social_channels)} />
      </Section>

      <Section title="Business & team">
        <Field label="Primary contact" value={formatText(record.primary_contact_name)} />
        <Field label="Contact email" value={formatText(record.primary_contact_email)} />
        <Field label="Email verified" value={formatBoolean(record.contact_email_verified)} />
        <Field label="Contact phone" value={formatText(record.primary_contact_phone)} />
        <Field label="Contact's role" value={formatText(record.contact_role)} />
        <Field label="Compliance contact" value={formatText(record.compliance_contact)} />
        <Field label="Practitioners" value={formatPractitioners(record.practitioners)} />
        <Field label="Decision maker" value={formatText(record.decision_maker)} />
        <Field label="Enquiries handled by" value={formatText(record.enquiries_handled_by)} />
        <Field label="Content approver" value={formatText(record.content_approver)} />
        <Field label="Advertising approver" value={formatText(record.advertising_approver)} />
        <Field label="Urgent contact" value={formatText(record.urgent_contact)} />
        <Field label="Opening hours" value={formatText(record.opening_hours)} />
        <Field label="Consultation model" value={formatText(record.consultation_model)} />
        <Field label="Booking method" value={formatText(record.booking_method)} />
      </Section>

      <Section title="Marketing access">
        <Field label="Current channels" value={formatList(record.current_channels)} />
        <Field label="Monthly ad spend" value={enumLabel("monthly_ad_spend_range", record.monthly_ad_spend_range)} />
        <Field label="Monthly revenue" value={enumLabel("monthly_revenue_range", record.monthly_revenue_range)} />
        <Field label="Current agency/freelancer" value={formatText(record.current_agency_or_freelancer)} />
        <Field label="Monthly enquiries" value={formatText(record.monthly_enquiries)} />
        <Field label="Current show rate" value={formatText(record.current_show_rate)} />
        <Field label="Has existing CRM" value={formatBoolean(record.has_existing_crm)} />
        <Field label="Existing CRM" value={formatText(record.existing_crm_name)} />
        <Field label="Booking system" value={formatText(record.booking_system_name)} />
        <Field label="Past agency experience" value={formatText(record.past_agency_experience)} />
      </Section>

      {record.ad_account_status.length > 0 ? (
        <Section title="Ad account access">
          {record.ad_account_status.map((a) => (
            <Field key={a.platform} label={enumLabel("ad_account_platform", a.platform)} value={enumLabel("ad_account_status", a.status)} />
          ))}
        </Section>
      ) : null}

      <div className="bg-bone rounded-xl border border-midnight/10 p-5">
        <h3 className="font-display text-lg mb-4">Content & brand</h3>
        <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <Field label="Treatment priorities" value={formatText(record.treatment_priorities)} />
          <Field label="Brand guidelines notes" value={formatText(record.brand_guidelines_notes)} />
          <Field label="Brand folder link" value={formatText(record.brand_folder_link)} />
          <Field label="Brand feel" value={formatList(record.brand_feel)} />
          <Field label="Brands admired" value={formatText(record.brands_admired)} />
          <Field label="Style to avoid" value={formatText(record.style_to_avoid)} />
          <Field label="Growth priority services" value={formatText(record.growth_priority_services)} />
          <Field label="Differentiators" value={formatText(record.differentiators)} />
          <Field label="Common questions" value={formatText(record.common_questions)} />
          <Field label="Objections" value={formatText(record.objections)} />
          <Field label="Ideal client type" value={formatText(record.ideal_client_type)} />
          <Field label="Treatments not to promote" value={formatText(record.treatments_not_to_promote)} />
          <Field label="90-day goal" value={formatText(record.ninety_day_goal)} />
        </dl>

        <h4 className="text-xs uppercase tracking-wide text-grey-on-light font-medium mt-5 mb-3 pt-4 border-t border-midnight/10">
          Production
        </h4>
        <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <Field label="Camera comfort" value={enumLabel("camera_comfort", record.camera_comfort)} />
          <Field label="Who can appear" value={formatText(record.who_can_appear)} />
          <Field label="Filming availability" value={formatText(record.filming_availability)} />
          <Field label="Filming areas" value={formatText(record.filming_areas)} />
          <Field label="Filming restrictions" value={formatText(record.filming_restrictions)} />
          <Field label="Filming-suitable treatments" value={formatText(record.filming_suitable_treatments)} />
          <Field label="Has consent procedures" value={formatBoolean(record.has_consent_procedures)} />
        </dl>
      </div>

      <p className="text-xs text-grey-on-light">
        Read-only — this data comes from the Client Portal.{" "}
        <Link href={`/organisations/${organisationId}?tab=activity`} className="text-copper-text hover:underline">
          See onboarding activity
        </Link>
      </p>
    </div>
  );
}
