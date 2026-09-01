"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTask } from "@/lib/crm/actions";
import type { Task } from "@/lib/crm/task-types";
import type { TeamMemberOption } from "@/lib/crm/deal-types";
import { TaskItem } from "@/components/crm/TaskItem";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

// Shared by the deal detail page and the organisation's Tasks tab — same
// underlying data and form, just scoped differently. On a deal, dealId
// is fixed and every task is deal-scoped. On an organisation, dealId is
// omitted (the task is organisation-level only) and the list can be a
// mix of organisation-only and deal-scoped tasks belonging to it — hence
// showDeal defaults to true there, so it's clear which is which.
export function TasksPanel({
  organisationId,
  dealId,
  tasks,
  teamMembers,
  showDeal = false,
}: {
  organisationId: string;
  dealId?: string;
  tasks: Task[];
  teamMembers: TeamMemberOption[];
  showDeal?: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [titleError, setTitleError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setTitleError("Enter a task title.");
      document.getElementById("task-title")?.focus();
      return;
    }
    setTitleError(undefined);

    setSaving(true);
    const result = await createTask({ title, dueAt, assignedTo, dealId, organisationId });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setTitle("");
    setDueAt("");
    setAssignedTo("");
    setAdding(false);
    router.refresh();
  }

  return (
    <div className="bg-bone rounded-xl border border-midnight/10 p-5">
      <div className="flex items-center justify-end mb-3">
        {!adding ? (
          <Button variant="ghost" onClick={() => setAdding(true)}>
            Add task
          </Button>
        ) : null}
      </div>

      {tasks.length === 0 && !adding ? <p className="text-sm text-grey-on-light">No tasks yet.</p> : null}

      {tasks.length > 0 ? (
        <ul className="mb-2">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} showDeal={showDeal} showOrganisation={false} />
          ))}
        </ul>
      ) : null}

      {adding ? (
        <form onSubmit={handleAdd} className="space-y-4 pt-2" noValidate>
          <Field label="Title" htmlFor="task-title" required error={titleError}>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) setTitleError(undefined);
              }}
            />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Due date" htmlFor="task-dueAt" optional>
              <Input id="task-dueAt" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </Field>
            <Field label="Assignee" htmlFor="task-assignedTo" optional>
              <Select id="task-assignedTo" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                <option value="">Unassigned</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            <Button type="submit" loading={saving}>
              {saving ? "Adding…" : "Add task"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
