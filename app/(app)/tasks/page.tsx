import { listTasks } from "@/lib/crm/tasks";
import { listOrganisations } from "@/lib/crm/organisations";
import { listTeamMembers } from "@/lib/crm/team-members";
import { TaskItem } from "@/components/crm/TaskItem";
import { NewTaskForm } from "@/components/crm/NewTaskForm";

export default async function TasksPage() {
  const [tasks, organisations, teamMembers] = await Promise.all([
    listTasks(),
    listOrganisations(),
    listTeamMembers(),
  ]);

  const openCount = tasks.filter((t) => t.status === "open").length;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl leading-tight mb-1">Tasks</h1>
          <p className="text-sm text-grey-on-light">
            {openCount} open task{openCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="mt-6 mb-6">
        <NewTaskForm organisations={organisations} teamMembers={teamMembers} />
      </div>

      {tasks.length === 0 ? (
        <div className="bg-bone rounded-2xl border border-midnight/10 p-8 text-center">
          <p className="text-sm text-grey-on-light">No tasks yet.</p>
        </div>
      ) : (
        <div className="bg-bone rounded-2xl border border-midnight/10 px-6">
          <ul>
            {tasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
