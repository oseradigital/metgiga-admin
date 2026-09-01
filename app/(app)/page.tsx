import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveTeamMember } from "@/lib/supabase/team";
import { listOrganisationsWithSummary } from "@/lib/crm/organisations";
import type { OrganisationListItem } from "@/lib/crm/organisation-types";
import {
  getPipelineByStage,
  getMyTaskCounts,
  getMyOpenTasks,
  getActiveMRR,
  listRecentActivity,
  NEEDS_ATTENTION_DAYS,
  NEW_ORGANISATION_GRACE_HOURS,
} from "@/lib/crm/overview";
import { listDealStages } from "@/lib/crm/deals";
import { formatMoney, formatDateTime, formatRelativeTime } from "@/lib/format";
import { describeActivityEvent } from "@/lib/crm/describe-activity";

const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;

type AttentionRow = {
  org: OrganisationListItem;
  reason: string;
  actionLabel: string;
  actionHref: string;
};

// Mechanical, stated, not inferred — one reason and one direct action
// per organisation, picked in priority order (an overdue task outranks
// "no next action" outranks stale activity, since they can't co-occur
// the same way: an org either has a next action or doesn't). "lost"/
// "cancelled" are excluded outright, and anything younger than
// NEW_ORGANISATION_GRACE_HOURS is excluded too — a brand-new prospect
// with no task yet isn't neglect, it's normal.
function needsAttentionRow(org: OrganisationListItem): AttentionRow | null {
  if (org.status === "lost" || org.status === "cancelled") return null;

  const ageHours = (Date.now() - new Date(org.created_at).getTime()) / MS_PER_HOUR;
  if (ageHours < NEW_ORGANISATION_GRACE_HOURS) return null;

  if (org.nextAction) {
    if (org.nextAction.dueAt && new Date(org.nextAction.dueAt).getTime() < Date.now()) {
      const days = Math.max(1, Math.floor((Date.now() - new Date(org.nextAction.dueAt).getTime()) / MS_PER_DAY));
      return {
        org,
        reason: `Task overdue by ${days} day${days === 1 ? "" : "s"}`,
        actionLabel: "View task",
        actionHref: `/organisations/${org.id}?tab=tasks`,
      };
    }
    return null;
  }

  if (!org.lastActivityAt) {
    return {
      org,
      reason: "No next action, no activity",
      actionLabel: org.activeDeal ? "Open deal" : "Add task",
      actionHref: org.activeDeal ? `/deals/${org.activeDeal.id}` : `/organisations/${org.id}?tab=tasks`,
    };
  }

  const staleDays = Math.floor((Date.now() - new Date(org.lastActivityAt).getTime()) / MS_PER_DAY);
  if (staleDays > NEEDS_ATTENTION_DAYS) {
    return {
      org,
      reason: `No next action · no activity in ${staleDays} days`,
      actionLabel: "Add task",
      actionHref: `/organisations/${org.id}?tab=tasks`,
    };
  }

  return { org, reason: "No next action", actionLabel: "Add task", actionHref: `/organisations/${org.id}?tab=tasks` };
}

// Same reasoning as needsAttentionRow above: a module-scope helper, not
// an inline Date.now() in the component body, which the React
// Compiler's purity check treats as an impure render call.
function isTaskOverdue(dueAt: string | null): boolean {
  return dueAt ? new Date(dueAt).getTime() < Date.now() - MS_PER_DAY : false;
}

export default async function OverviewPage() {
  const member = await getActiveTeamMember();
  // The (app) layout already gates this route — see the same pattern
  // in app/(app)/profile/page.tsx for why this is a redirect, not a
  // bare `!` assertion.
  if (!member) redirect("/login");

  const [organisations, pipeline, myTasks, myOpenTasks, activeMRR, recentActivity, stages] = await Promise.all([
    listOrganisationsWithSummary(),
    getPipelineByStage(),
    getMyTaskCounts(member.id),
    getMyOpenTasks(member.id),
    getActiveMRR(),
    listRecentActivity(10),
    listDealStages(),
  ]);

  const needsAttention = organisations
    .map(needsAttentionRow)
    .filter((row): row is AttentionRow => row !== null);

  const populatedStages = pipeline.filter((s) => s.count > 0);
  const totalPipelineValue = pipeline.filter((s) => !s.isWon && !s.isLost).reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl leading-tight">Overview</h1>
        <p className="text-sm text-grey-on-light mt-1">Here&rsquo;s what needs your attention today.</p>
      </div>

      {/* Two stat tiles — per the approved sidebar mockup. Potential
          pipeline is the same total already computed below for the
          Pipeline card; Active MRR is new (getActiveMRR). */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="font-display text-3xl text-midnight tabular-nums">{formatMoney(totalPipelineValue, "GBP") ?? "£0"}</p>
          <p className="text-sm text-grey-on-light mt-0.5">Potential pipeline</p>
        </div>
        <div>
          <p className="font-display text-3xl text-midnight tabular-nums">{formatMoney(activeMRR, "GBP") ?? "£0"}</p>
          <p className="text-sm text-grey-on-light mt-0.5">Active MRR</p>
        </div>
      </div>

      {/* Needs attention */}
      <section className="bg-bone rounded-xl border border-midnight/10 p-5">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-xs uppercase tracking-wide text-grey-on-light font-medium">Needs attention</h2>
          {needsAttention.length > 0 ? (
            <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-copper/10 text-copper-text text-xs font-medium">
              {needsAttention.length}
            </span>
          ) : null}
        </div>
        {needsAttention.length === 0 ? (
          <p className="text-sm text-grey-on-light">Nothing needs attention right now.</p>
        ) : (
          <ul>
            {needsAttention.map(({ org, reason, actionLabel, actionHref }, i) => (
              <li
                key={org.id}
                className={`flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm ${i > 0 ? "border-t border-midnight/10" : ""}`}
              >
                <Link href={`/organisations/${org.id}`} className="text-midnight hover:text-copper-text transition-colors">
                  {org.name}
                </Link>
                <div className="flex items-center gap-4">
                  <span className="text-grey-on-light text-xs whitespace-nowrap">{reason}</span>
                  <Link href={actionHref} className="text-xs text-copper-text hover:underline whitespace-nowrap">
                    {actionLabel} →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pipeline */}
        <section className="bg-bone rounded-xl border border-midnight/10 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs uppercase tracking-wide text-grey-on-light font-medium">Pipeline</h2>
            <span className="text-xs text-grey-on-light">
              Potential value: {formatMoney(totalPipelineValue, "GBP") ?? "£0"}
            </span>
          </div>
          {populatedStages.length === 0 ? (
            <p className="text-sm text-grey-on-light">
              No open deals yet.{" "}
              <Link href="/deals/new" className="text-copper-text hover:underline">
                Create one
              </Link>
              .
            </p>
          ) : (
            <ul>
              {populatedStages.map((stage, i) => (
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
          )}
          <Link href="/deals" className="block text-xs text-copper-text hover:underline mt-3">
            View all deals →
          </Link>
        </section>

        {/* My tasks */}
        <section className="bg-bone rounded-xl border border-midnight/10 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs uppercase tracking-wide text-grey-on-light font-medium">My tasks</h2>
            <div className="flex items-center gap-3 text-xs text-grey-on-light">
              <span>{myTasks.dueToday} due today</span>
              <span className={myTasks.overdue > 0 ? "text-error" : undefined}>{myTasks.overdue} overdue</span>
            </div>
          </div>
          {myOpenTasks.length === 0 ? (
            <p className="text-sm text-grey-on-light">Nothing due today or overdue.</p>
          ) : (
            <ul>
              {myOpenTasks.map((task, i) => {
                const overdue = isTaskOverdue(task.dueAt);
                return (
                  <li key={task.id} className={`py-2 text-sm ${i > 0 ? "border-t border-midnight/10" : ""}`}>
                    <Link
                      href={task.organisationId ? `/organisations/${task.organisationId}?tab=tasks` : "/tasks"}
                      className="flex items-center justify-between gap-4 hover:text-copper-text transition-colors"
                    >
                      <span className="text-midnight">
                        {task.title}
                        {task.organisationName ? <span className="text-grey-on-light"> · {task.organisationName}</span> : null}
                      </span>
                      <span className={`text-xs whitespace-nowrap ${overdue ? "text-error" : "text-grey-on-light"}`}>
                        {task.dueAt ? formatRelativeTime(task.dueAt) : "No due date"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/tasks" className="block text-xs text-copper-text hover:underline mt-3">
            View all tasks →
          </Link>
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
