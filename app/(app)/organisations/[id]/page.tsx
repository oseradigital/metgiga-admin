import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrganisation } from "@/lib/crm/organisations";
import { listContacts } from "@/lib/crm/contacts";
import { listDealsForOrganisation } from "@/lib/crm/deals-for-org";
import { listTasksForOrganisation } from "@/lib/crm/tasks";
import { listDocumentsForOrganisation } from "@/lib/crm/documents";
import { listActivityForOrganisation } from "@/lib/crm/activity";
import { listDealStages } from "@/lib/crm/deals";
import { listTeamMembers } from "@/lib/crm/team-members";
import { getOnboardingRecordForOrganisation } from "@/lib/crm/onboarding";
import { OrganisationEditor } from "@/components/crm/OrganisationEditor";
import { ContactsPanel } from "@/components/crm/ContactsPanel";
import { TasksPanel } from "@/components/crm/TasksPanel";
import { DocumentsPanel } from "@/components/crm/DocumentsPanel";
import { ActivityTimeline } from "@/components/crm/ActivityTimeline";
import { OnboardingPanel } from "@/components/crm/OnboardingPanel";
import { OrganisationTabs, type Tab } from "@/components/crm/OrganisationTabs";
import { OrganisationMenu } from "@/components/crm/OrganisationMenu";
import { Badge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/format";

const STATUS_TONE: Record<string, "neutral" | "copper" | "success"> = {
  prospect: "neutral",
  activating: "copper",
  active: "success",
  paused: "neutral",
  cancelled: "neutral",
  lost: "neutral",
};

const TAB_PARAM: Record<string, Tab> = {
  overview: "Overview",
  contacts: "Contacts",
  deals: "Deals",
  tasks: "Tasks",
  documents: "Documents",
  onboarding: "Onboarding",
  activity: "Activity",
};

export default async function OrganisationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; edit?: string; from?: string }>;
}) {
  const { id } = await params;
  const { tab, edit, from } = await searchParams;
  const organisation = await getOrganisation(id);

  // Also what a real RLS denial or a bad/foreign id looks like — both
  // read as "not found" rather than a raw error, which is correct here
  // (nothing about this app should distinguish "doesn't exist" from
  // "you can't see it" to the caller).
  if (!organisation) notFound();

  const [contacts, deals, tasks, documents, activity, stages, teamMembers, onboardingRecord] = await Promise.all([
    listContacts(id),
    listDealsForOrganisation(id),
    listTasksForOrganisation(id),
    listDocumentsForOrganisation(id),
    listActivityForOrganisation(id),
    listDealStages(),
    listTeamMembers(),
    getOnboardingRecordForOrganisation(id),
  ]);

  const primaryContact = contacts.find((c) => c.is_primary) ?? contacts[0];
  const primaryContactName = primaryContact ? [primaryContact.first_name, primaryContact.last_name].filter(Boolean).join(" ") : null;
  const activeDeal = deals[0]
    ? {
        title: deals[0].title,
        package: deals[0].package,
        stageLabel: deals[0].stage_label,
        monthlyValue: deals[0].monthly_value,
        currency: deals[0].currency,
      }
    : null;

  // The list page keeps its own current search/filter state in the URL
  // and passes it along as `from` on every row link — using that exact
  // URL to return, rather than a hardcoded "/organisations" or
  // router.back() (which would follow whatever's actually in browser
  // history, not necessarily the list at all if this page was reached
  // some other way, e.g. from Overview's Needs attention).
  const backHref = from && from.startsWith("/organisations") ? from : "/organisations";

  return (
    <div className="max-w-3xl">
      <Link href={backHref} className="text-sm text-grey-on-light hover:text-midnight transition-colors">
        ← Organisations
      </Link>

      <div className="flex items-center gap-2 mt-3 mb-5">
        <h1 className="font-display text-2xl leading-tight">{organisation.name}</h1>
        <Badge tone={STATUS_TONE[organisation.status]}>{organisation.status}</Badge>
        <OrganisationMenu organisationId={organisation.id} />
      </div>

      <OrganisationTabs
        initialTab={tab ? TAB_PARAM[tab] : undefined}
        panels={{
          Overview: (
            <OrganisationEditor
              organisation={organisation}
              primaryContactName={primaryContactName}
              activeDeal={activeDeal}
              startInEditMode={edit === "1"}
            />
          ),
          Contacts: <ContactsPanel organisationId={organisation.id} contacts={contacts} />,
          Deals: (
            <div className="bg-bone rounded-xl border border-midnight/10 p-5">
              <div className="flex items-center justify-end mb-3">
                <Link href={`/deals/new?organisationId=${organisation.id}`} className="text-sm text-copper-text hover:underline">
                  New deal
                </Link>
              </div>
              {deals.length === 0 ? (
                <p className="text-sm text-grey-on-light">No deals yet.</p>
              ) : (
                <ul>
                  {deals.map((deal, i) => (
                    <li key={deal.id} className={i > 0 ? "border-t border-midnight/10" : ""}>
                      <Link href={`/deals/${deal.id}`} className="flex items-center justify-between gap-4 text-sm py-2.5">
                        <span className="text-midnight">{deal.package || deal.title}</span>
                        <span className="text-grey-on-light whitespace-nowrap">
                          {deal.stage_label}
                          {formatMoney(deal.monthly_value, deal.currency) ? ` · ${formatMoney(deal.monthly_value, deal.currency)}` : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ),
          Tasks: (
            <TasksPanel organisationId={organisation.id} tasks={tasks} teamMembers={teamMembers} showDeal />
          ),
          Documents: <DocumentsPanel organisationId={organisation.id} documents={documents} />,
          Onboarding: <OnboardingPanel organisationId={organisation.id} record={onboardingRecord} />,
          Activity: (
            <ActivityTimeline
              entityType="organisation"
              entityId={organisation.id}
              organisationId={organisation.id}
              events={activity}
              stages={stages}
              showHeading={false}
            />
          ),
        }}
      />
    </div>
  );
}
