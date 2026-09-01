"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTask } from "@/lib/crm/actions";
import type { Organisation } from "@/lib/crm/organisation-types";
import type { TeamMemberOption } from "@/lib/crm/deal-types";
import { TASK_PRIORITIES, type TaskPriority } from "@/lib/crm/task-types";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

export function NewTaskForm({
  organisations,
  teamMembers,
}: {
  organisations: Organisation[];
  teamMembers: TeamMemberOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [assignedTo, setAssignedTo] = useState("");
  const [organisationId, setOrganisationId] = useState("");
  const [titleError, setTitleError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setTitle("");
    setDueAt("");
    setPriority("normal");
    setAssignedTo("");
    setOrganisationId("");
    setTitleError(undefined);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setTitleError("Enter a task title.");
      document.getElementById("task-title")?.focus();
      return;
    }
    setTitleError(undefined);

    setSaving(true);
    const result = await createTask({
      title,
      dueAt,
      priority,
      assignedTo,
      organisationId,
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    reset();
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        New task
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-bone rounded-2xl border border-midnight/10 p-6 space-y-4" noValidate>
      <Field label="Title" htmlFor="task-title" required error={titleError}>
        <Input
          id="task-title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (titleError) setTitleError(undefined);
          }}
          placeholder="Follow up on proposal"
        />
      </Field>

      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Due date" htmlFor="task-dueAt" optional>
          <Input id="task-dueAt" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </Field>
        <Field label="Priority" htmlFor="task-priority">
          <Select id="task-priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
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

      <Field label="Organisation" htmlFor="task-organisationId" optional>
        <Select id="task-organisationId" value={organisationId} onChange={(e) => setOrganisationId(e.target.value)}>
          <option value="">None</option>
          {organisations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </Select>
      </Field>

      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={saving}>
          {saving ? "Adding…" : "Add task"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
