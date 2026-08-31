import { notFound } from "next/navigation";
import Link from "next/link";
import { getDeal, listDealStages } from "@/lib/crm/deals";
import { listTeamMembers } from "@/lib/crm/team-members";
import { listActivity } from "@/lib/crm/activity";
import { DealEditor } from "@/components/crm/DealEditor";
import { ActivityTimeline } from "@/components/crm/ActivityTimeline";

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deal = await getDeal(id);
  if (!deal) notFound();

  const [stages, teamMembers, activity] = await Promise.all([
    listDealStages(),
    listTeamMembers(),
    listActivity("deal", id),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/deals" className="text-sm text-grey-on-light hover:text-midnight transition-colors">
        ← Deals
      </Link>
      <Link
        href={`/organisations/${deal.organisation_id}`}
        className="block text-xs text-copper-text hover:underline -mt-4"
      >
        View {deal.organisation_name} →
      </Link>

      <DealEditor deal={deal} stages={stages} teamMembers={teamMembers} />
      <ActivityTimeline
        entityType="deal"
        entityId={deal.id}
        organisationId={deal.organisation_id}
        events={activity}
        stages={stages}
      />
    </div>
  );
}
