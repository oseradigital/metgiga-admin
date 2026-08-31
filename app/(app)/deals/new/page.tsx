import { listOrganisations } from "@/lib/crm/organisations";
import { listDealStages } from "@/lib/crm/deals";
import { listTeamMembers } from "@/lib/crm/team-members";
import { NewDealForm } from "@/components/crm/NewDealForm";

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ organisationId?: string }>;
}) {
  const { organisationId } = await searchParams;
  const [organisations, stages, teamMembers] = await Promise.all([
    listOrganisations(),
    listDealStages(),
    listTeamMembers(),
  ]);

  return (
    <div className="max-w-lg">
      <h1 className="font-display text-2xl mb-1.5">New deal</h1>
      <p className="text-sm text-grey-on-light mb-8">Title, organisation and stage are all that's required.</p>
      <NewDealForm
        organisations={organisations}
        stages={stages}
        teamMembers={teamMembers}
        defaultOrganisationId={organisationId}
      />
    </div>
  );
}
