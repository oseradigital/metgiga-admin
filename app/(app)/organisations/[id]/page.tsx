import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrganisation } from "@/lib/crm/organisations";
import { listContacts } from "@/lib/crm/contacts";
import { listDealsForOrganisation } from "@/lib/crm/deals-for-org";
import { listTasksForOrganisation } from "@/lib/crm/tasks";
import { listActivityForOrganisation } from "@/lib/crm/activity";
import { listDealStages } from "@/lib/crm/deals";
import { listTeamMembers } from "@/lib/crm/team-members";
import { OrganisationEditor } from "@/components/crm/OrganisationEditor";
import { ContactsPanel } from "@/components/crm/ContactsPanel";
import { TasksPanel } from "@/components/crm/TasksPanel";
import { ActivityTimeline } from "@/components/crm/ActivityTimeline";
import { OrganisationTabs } from "@/components/crm/OrganisationTabs";
import { Badge } from "@/components/ui/Badge";

const STATUS_TONE: Record<string, "neutral" | "copper" | "success"> = {
  prospect: "neutral",
  activating: "copper",
  active: "success",
  paused: "neutral",
  cancelled: "neutral",
  lost: "neutral",
};

function formatMoney(value: number | null, currency: string) {
  if (value === null) return null;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export default async function OrganisationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const organisation = await getOrganisation(id);

  // Also what a real RLS denial or a bad/foreign id looks like — both
  // read as "not found" rather than a raw error, which is correct here
  // (nothing about this app should distinguish "doesn't exist" from
  // "you can't see it" to the caller).
  if (!organisation) notFound();

  const [contacts, deals, tasks, activity, stages, teamMembers] = await Promise.all([
    listContacts(id),
    listDealsForOrganisation(id),
    listTasksForOrganisation(id),
    listActivityForOrganisation(id),
    listDealStages(),
    listTeamMembers(),
  ]);

  const primaryContact = contacts.find((c) => c.is_primary) ?? contacts[0];
  const primaryContactName = primaryContact ? [primaryContact.first_name, primaryContact.last_name].filter(Boolean).join(" ") : null;
  const activeDeal = deals[0]
    ? { title: deals[0].title, stageLabel: deals[0].stage_label, monthlyValue: deals[0].monthly_value, currency: deals[0].currency }
    : null;

  return (
    <div className="max-w-3xl">
      <Link href="/organisations" className="text-sm text-grey-on-light hover:text-midnight transition-colors">
        ← Organisations
      </Link>

      <div className="flex items-center gap-3 mt-3 mb-5">
        <h1 className="font-display text-2xl leading-tight">{organisation.name}</h1>
        <Badge tone={STATUS_TONE[organisation.status]}>{organisation.status}</Badge>
      </div>

      <OrganisationTabs
        panels={{
          Overview: (
            <OrganisationEditor
              organisation={organisation}
              primaryContactName={primaryContactName}
              activeDeal={activeDeal}
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
                        <span className="text-midnight">{deal.title}</span>
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
