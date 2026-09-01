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

// Compact, deal-scoped sibling of the global /tasks page — same
// underlying data, no organisation/deal picker since both are already
// fixed by the page this sits on.
export function DealTasksPanel({
  dealId,
  organisationId,
  tasks,
  teamMembers,
}: {
  dealId: string;
  organisationId: string;
  tasks: Task[];
  teamMembers: TeamMemberOption[];
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
      document.getElementById("deal-task-title")?.focus();
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
    <div className="bg-bone rounded-2xl border border-midnight/10 p-6 sm:p-8">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display text-xl">Tasks</h2>
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
            <TaskItem key={task.id} task={task} showDeal={false} showOrganisation={false} />
          ))}
        </ul>
      ) : null}

      {adding ? (
        <form onSubmit={handleAdd} className="space-y-4 pt-2" noValidate>
          <Field label="Title" htmlFor="deal-task-title" required error={titleError}>
            <Input
              id="deal-task-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) setTitleError(undefined);
              }}
            />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Due date" htmlFor="deal-task-dueAt" optional>
              <Input id="deal-task-dueAt" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </Field>
            <Field label="Assignee" htmlFor="deal-task-assignedTo" optional>
              <Select id="deal-task-assignedTo" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
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
