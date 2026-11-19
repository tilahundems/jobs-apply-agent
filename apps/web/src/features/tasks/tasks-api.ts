import type { Page, TaskInput } from "@et/contracts"
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  taskInputSchema,
} from "@et/contracts"
import { queryOptions } from "@tanstack/react-query"
import type { User } from "@/features/users"
import { api, json } from "@/lib/api"
import { type ListQuery, listQueryString } from "@/lib/table-search-params"

export type { User }
export {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
}
export type TaskStatus = (typeof TASK_STATUSES)[number]
export type TaskPriority = (typeof TASK_PRIORITIES)[number]
export type TaskProject = { id: string; name: string }
export type CreateTaskInput = TaskInput
export type Task = {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  assigneeId: string | null
  projectId: string | null
  dueDate: string | null
  createdAt: string
  updatedAt: string
  project: TaskProject | null
  assignee: User | null
}
const normalize = (task: Task): Task => ({
  ...task,
  project: task.project ?? null,
  assignee: task.assignee ?? null,
})
export async function listTasks() {
  return (await api<Task[]>("/api/v1/tasks")).map(normalize)
}
export async function createTask(input: TaskInput) {
  return normalize(
    await api<Task>("/api/v1/tasks", json("POST", taskInputSchema.parse(input)))
  )
}
export async function updateTask(id: string, input: TaskInput) {
  return normalize(
    await api<Task>(
      `/api/v1/tasks/${encodeURIComponent(id)}`,
      json("PATCH", taskInputSchema.parse(input))
    )
  )
}
export async function deleteTask(id: string) {
  await api(`/api/v1/tasks/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  return { ok: true as const }
}
export const tasksQueryOptions = queryOptions({
  queryKey: ["tasks"],
  queryFn: listTasks,
})
export const taskPageQueryOptions = (query: ListQuery) =>
  queryOptions({
    queryKey: ["tasks", "page", query] as const,
    queryFn: () =>
      api<Page<Task>>(`/api/v1/tasks/page?${listQueryString(query)}`),
  })
