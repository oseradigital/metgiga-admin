import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrganisation } from "@/lib/crm/organisations";
import { listContacts } from "@/lib/crm/contacts";
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

  const contacts = await listContacts(id);

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/organisations" className="text-sm text-grey-on-light hover:text-midnight transition-colors">
        ← Organisations
      </Link>

      <OrganisationEditor organisation={organisation} />
      <ContactsPanel organisationId={organisation.id} contacts={contacts} />
    </div>
  );
}
