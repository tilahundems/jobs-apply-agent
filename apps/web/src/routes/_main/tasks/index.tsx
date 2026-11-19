import { createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/page-header"
import { RouteError } from "@/components/route-error"
import { CanView, canReadSubject, requirePageAbility } from "@/features/authz"
import { projectsQueryOptions } from "@/features/projects"
import { TasksTable, taskPageQueryOptions } from "@/features/tasks"
import { taskTableSearch } from "@/features/tasks/tasks-table-columns"
import { usersQueryOptions } from "@/features/users"

export const Route = createFileRoute("/_main/tasks/")({
  validateSearch: taskTableSearch.validateSearch,
  beforeLoad: ({ context }) => {
    requirePageAbility(context.rules, "read", "Task")
  },
  loaderDeps: ({ search }) => taskTableSearch.toQuery(search),
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(taskPageQueryOptions(deps)),
      canReadSubject(context.rules, "Project")
        ? context.queryClient.ensureQueryData(projectsQueryOptions)
        : Promise.resolve(),
      canReadSubject(context.rules, "User")
        ? context.queryClient.ensureQueryData(usersQueryOptions)
        : Promise.resolve(),
    ]),
  errorComponent: RouteError,
  component: TasksPage,
})

function TasksPage() {
  return (
    <CanView a="Task">
      <div className="flex flex-col gap-4 pt-2 pb-4 lg:pt-3 lg:pb-6">
        <PageHeader
          title="Tasks"
          subtitle="Track work across projects and assignees."
        />
        <TasksTable />
      </div>
    </CanView>
  )
}
