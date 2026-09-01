"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setTaskStatus } from "@/lib/crm/actions";
import type { Task } from "@/lib/crm/task-types";

function formatDue(dueAt: string | null): { label: string; overdue: boolean } | null {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = due < today;
  return {
    label: due.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    overdue,
  };
}

// showOrganisation/showDeal: the global /tasks list shows both (a task
// can belong to neither, either, or both); the deal-scoped panel already
// has that context from its own page, so showing it again on every row
// would be noise.
export function TaskItem({
  task,
  showOrganisation = true,
  showDeal = true,
}: {
  task: Task;
  showOrganisation?: boolean;
  showDeal?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const due = formatDue(task.due_at);
  const done = task.status === "done";

  async function toggle() {
    setPending(true);
    const result = await setTaskStatus(task.id, done ? "open" : "done");
    setPending(false);
    if (result.ok) router.refresh();
  }

  return (
    <li className="flex items-start gap-3 py-3 border-t border-midnight/10 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={done}
        aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        className={`mt-0.5 size-4 rounded border shrink-0 transition-colors disabled:opacity-50 ${
          done ? "bg-copper border-copper" : "border-midnight/25 bg-bone"
        }`}
      >
        {done ? (
          <svg viewBox="0 0 16 16" fill="none" className="size-full p-0.5" aria-hidden="true">
            <path d="M3 8l3 3 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </button>

      <div className="min-w-0 flex-1">
        <p className={`text-sm ${done ? "text-grey-on-light line-through" : "text-midnight"}`}>{task.title}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-grey-on-light">
          {due ? (
            <span className={due.overdue && !done ? "text-error" : ""}>Due {due.label}</span>
          ) : null}
          {task.priority !== "normal" ? <span className="capitalize">{task.priority} priority</span> : null}
          {task.assignee_name ? <span>{task.assignee_name}</span> : null}
          {showDeal && task.deal_id ? (
            <Link href={`/deals/${task.deal_id}`} className="text-copper-text hover:underline">
              {task.deal_title}
            </Link>
          ) : null}
          {showOrganisation && !task.deal_id && task.organisation_id ? (
            <Link href={`/organisations/${task.organisation_id}`} className="text-copper-text hover:underline">
              {task.organisation_name}
            </Link>
          ) : null}
        </div>
      </div>
    </li>
  );
}
