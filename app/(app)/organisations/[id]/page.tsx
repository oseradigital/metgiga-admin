import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrganisation } from "@/lib/crm/organisations";
import { listContacts } from "@/lib/crm/contacts";
import { listDealsForOrganisation } from "@/lib/crm/deals-for-org";
import { OrganisationEditor } from "@/components/crm/OrganisationEditor";
import { ContactsPanel } from "@/components/crm/ContactsPanel";

export default async function OrganisationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const organisation = await getOrganisation(id);

  // Also what a real RLS denial or a bad/foreign id looks like — both
  // read as "not found" rather than a raw error, which is correct here
  // (nothing about this app should distinguish "doesn't exist" from
  // "you can't see it" to the caller).
  if (!organisation) notFound();

  const [contacts, deals] = await Promise.all([listContacts(id), listDealsForOrganisation(id)]);

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/organisations" className="text-sm text-grey-on-light hover:text-midnight transition-colors">
        ← Organisations
      </Link>

      <OrganisationEditor organisation={organisation} />
      <ContactsPanel organisationId={organisation.id} contacts={contacts} />

      <div className="bg-bone rounded-2xl border border-midnight/10 p-6 sm:p-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl">Deals</h2>
          <Link href={`/deals/new?organisationId=${organisation.id}`} className="text-sm text-copper-text hover:underline">
            New deal
          </Link>
        </div>
        {deals.length === 0 ? (
          <p className="text-sm text-grey-on-light">No deals yet.</p>
        ) : (
          <ul className="space-y-3">
            {deals.map((deal) => (
              <li key={deal.id} className="border-t border-midnight/10 pt-3 first:border-t-0 first:pt-0">
                <Link href={`/deals/${deal.id}`} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-midnight">{deal.title}</span>
                  <span className="text-grey-on-light whitespace-nowrap">{deal.stage_label}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
