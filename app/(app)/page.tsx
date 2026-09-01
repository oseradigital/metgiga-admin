import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveTeamMember } from "@/lib/supabase/team";
import { listOrganisationsWithSummary } from "@/lib/crm/organisations";
import { getPipelineByStage, getMyTaskCounts, listRecentActivity, NEEDS_ATTENTION_DAYS } from "@/lib/crm/overview";
import { listDealStages } from "@/lib/crm/deals";
import { formatMoney, formatDateTime, formatRelativeTime } from "@/lib/format";
import { describeActivityEvent } from "@/lib/crm/describe-activity";

const MS_PER_DAY = 86_400_000;

// Mechanical, stated, not inferred: an organisation needs attention if
// it has no next open task, or its last activity is missing/older than
// NEEDS_ATTENTION_DAYS. "lost"/"cancelled" are excluded — not a guess
// about which live organisations matter more, just that a closed
// pipeline stage has nothing left to attend to.
function needsAttentionReason(org: {
  status: string;
  nextAction: unknown;
  lastActivityAt: string | null;
}): string | null {
  if (org.status === "lost" || org.status === "cancelled") return null;

  const reasons: string[] = [];
  if (!org.nextAction) reasons.push("No next action");
  if (!org.lastActivityAt) {
    reasons.push("No activity yet");
  } else if ((Date.now() - new Date(org.lastActivityAt).getTime()) / MS_PER_DAY > NEEDS_ATTENTION_DAYS) {
    reasons.push(`No activity in ${NEEDS_ATTENTION_DAYS}+ days`);
  }
  return reasons.length ? reasons.join(" · ") : null;
}

export default async function OverviewPage() {
  const member = await getActiveTeamMember();
  // The (app) layout already gates this route — see the same pattern
  // in app/(app)/profile/page.tsx for why this is a redirect, not a
  // bare `!` assertion.
  if (!member) redirect("/login");

  const [organisations, pipeline, myTasks, recentActivity, stages] = await Promise.all([
    listOrganisationsWithSummary(),
    getPipelineByStage(),
    getMyTaskCounts(member.id),
    listRecentActivity(10),
    listDealStages(),
  ]);

  const needsAttention = organisations
    .map((org) => ({ org, reason: needsAttentionReason(org) }))
    .filter((row): row is { org: (typeof organisations)[number]; reason: string } => row.reason !== null);

  const totalPipelineValue = pipeline.filter((s) => !s.isWon && !s.isLost).reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-display text-2xl leading-tight">Overview</h1>

      {/* Needs attention */}
      <section className="bg-bone rounded-xl border border-midnight/10 p-5">
        <h2 className="text-xs uppercase tracking-wide text-grey-on-light font-medium mb-3">
          Needs attention
        </h2>
        {needsAttention.length === 0 ? (
          <p className="text-sm text-grey-on-light">Nothing needs attention right now.</p>
        ) : (
          <ul>
            {needsAttention.map(({ org, reason }, i) => (
              <li key={org.id} className={i > 0 ? "border-t border-midnight/10" : ""}>
                <Link
                  href={`/organisations/${org.id}`}
                  className="flex items-center justify-between gap-4 py-2 text-sm hover:text-copper-text transition-colors"
                >
                  <span className="text-midnight">{org.name}</span>
                  <span className="text-grey-on-light text-xs whitespace-nowrap">{reason}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid sm:grid-cols-2 gap-6">
        {/* Pipeline */}
        <section className="bg-bone rounded-xl border border-midnight/10 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs uppercase tracking-wide text-grey-on-light font-medium">Pipeline</h2>
            <span className="text-xs text-grey-on-light">
              Potential value: {formatMoney(totalPipelineValue, "GBP") ?? "£0"}
            </span>
          </div>
          <ul>
            {pipeline.map((stage, i) => (
              <li
                key={stage.id}
                className={`flex items-center justify-between gap-4 py-1.5 text-sm ${i > 0 ? "border-t border-midnight/10" : ""}`}
              >
                <span className={stage.isWon || stage.isLost ? "text-grey-on-light" : "text-midnight"}>{stage.label}</span>
                <span className="text-grey-on-light tabular-nums whitespace-nowrap">
                  {stage.count} · {formatMoney(stage.value, "GBP") ?? "£0"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* My tasks */}
        <section className="bg-bone rounded-xl border border-midnight/10 p-5">
          <h2 className="text-xs uppercase tracking-wide text-grey-on-light font-medium mb-3">My tasks</h2>
          <div className="grid grid-cols-2 gap-4">
            <Link href="/tasks" className="block hover:text-copper-text transition-colors">
              <p className="text-2xl font-display text-midnight">{myTasks.dueToday}</p>
              <p className="text-xs text-grey-on-light">Due today</p>
            </Link>
            <Link href="/tasks" className="block hover:text-copper-text transition-colors">
              <p className={`text-2xl font-display ${myTasks.overdue > 0 ? "text-error" : "text-midnight"}`}>
                {myTasks.overdue}
              </p>
              <p className="text-xs text-grey-on-light">Overdue</p>
            </Link>
          </div>
        </section>
      </div>

      {/* Recent activity */}
      <section className="bg-bone rounded-xl border border-midnight/10 p-5">
        <h2 className="text-xs uppercase tracking-wide text-grey-on-light font-medium mb-3">Recent activity</h2>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-grey-on-light">No activity yet.</p>
        ) : (
          <ul>
            {recentActivity.map((event, i) => (
              <li key={event.id} className={`py-2 text-sm ${i > 0 ? "border-t border-midnight/10" : ""}`}>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-midnight">
                    {describeActivityEvent(event.eventType, event.actorName, event.metadata, stages)}
                    {event.organisationName ? (
                      <>
                        {" "}
                        <Link href={`/organisations/${event.organisationId}`} className="text-copper-text hover:underline">
                          ({event.organisationName})
                        </Link>
                      </>
                    ) : null}
                  </span>
                  <span title={formatDateTime(event.createdAt)} className="text-xs text-grey-on-light whitespace-nowrap">
                    {formatRelativeTime(event.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
