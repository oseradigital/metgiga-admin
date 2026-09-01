export const TASK_STATUSES = ["open", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "normal", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export type Task = {
  id: string;
  organisation_id: string | null;
  organisation_name: string | null;
  deal_id: string | null;
  deal_title: string | null;
  assigned_to: string | null;
  assignee_name: string | null;
  title: string;
  description: string | null;
  due_at: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  created_at: string;
};
