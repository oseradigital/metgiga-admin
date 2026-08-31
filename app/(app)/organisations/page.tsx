import Link from "next/link";
import { listOrganisations } from "@/lib/crm/organisations";
import { Badge } from "@/components/ui/Badge";

const STATUS_TONE: Record<string, "neutral" | "copper" | "success"> = {
  prospect: "neutral",
  activating: "copper",
  active: "success",
  paused: "neutral",
  cancelled: "neutral",
  lost: "neutral",
};

export default async function OrganisationsPage() {
  const organisations = await listOrganisations();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl leading-tight mb-1">Organisations</h1>
          <p className="text-sm text-grey-on-light">Clinics and businesses, prospect through client.</p>
        </div>
        <Link
          href="/organisations/new"
          className="h-11 px-5 rounded-lg bg-midnight text-bone text-sm font-medium inline-flex items-center hover:bg-midnight-2 transition-colors"
        >
          New organisation
        </Link>
      </div>

      {organisations.length === 0 ? (
        <div className="bg-bone rounded-2xl border border-midnight/10 p-8 text-center">
          <p className="text-sm text-grey-on-light">No organisations yet.</p>
        </div>
      ) : (
        <div className="bg-bone rounded-2xl border border-midnight/10 overflow-hidden">
          <ul>
            {organisations.map((org, i) => (
              <li key={org.id} className={i > 0 ? "border-t border-midnight/10" : ""}>
                <Link
                  href={`/organisations/${org.id}`}
                  className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 hover:bg-midnight/[0.02] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-midnight truncate">{org.name}</p>
                    {org.industry ? (
                      <p className="text-xs text-grey-on-light truncate">{org.industry}</p>
                    ) : null}
                  </div>
                  <Badge tone={STATUS_TONE[org.status] ?? "neutral"}>{org.status}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
