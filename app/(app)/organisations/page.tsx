import Link from "next/link";
import { listOrganisationsWithSummary } from "@/lib/crm/organisations";
import { OrganisationsTable } from "@/components/crm/OrganisationsTable";

export default async function OrganisationsPage() {
  const organisations = await listOrganisationsWithSummary();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl leading-tight mb-1">Organisations</h1>
          <p className="text-sm text-grey-on-light">Businesses, prospect through client.</p>
        </div>
        <Link
          href="/organisations/new"
          className="h-9 px-4 rounded-lg bg-midnight text-bone text-sm font-medium inline-flex items-center hover:bg-midnight-2 transition-colors"
        >
          New organisation
        </Link>
      </div>

      <OrganisationsTable organisations={organisations} />
    </div>
  );
}
