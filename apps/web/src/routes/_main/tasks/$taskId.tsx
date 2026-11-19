import { useQueryErrorResetBoundary } from "@tanstack/react-query"
import { createFileRoute, notFound, useRouter } from "@tanstack/react-router"
import { useEffect } from "react"

import { DetailError, DetailPagePending } from "@/components/detail-page"
import { CanView, requirePageAbility } from "@/features/authz"
import { tasksQueryOptions } from "@/features/tasks/tasks-api"
import {
  TaskDetails,
  TaskDetailsNotFound,
} from "@/features/tasks/tasks-details"

export const Route = createFileRoute("/_main/tasks/$taskId")({
  beforeLoad: ({ context }) => {
    requirePageAbility(context.rules, "read", "Task")
  },
  loader: async ({ context, params }) => {
    const tasks = await context.queryClient.ensureQueryData(tasksQueryOptions)
    if (!tasks.some((task) => task.id === params.taskId)) throw notFound()
  },
  pendingComponent: DetailPagePending,
  errorComponent: TaskDetailsError,
  notFoundComponent: TaskDetailsNotFound,
  component: TaskDetailsPage,
})

function TaskDetailsError({ error }: { error: Error }) {
  const router = useRouter()
  const boundary = useQueryErrorResetBoundary()
  useEffect(() => {
    boundary.reset()
  }, [boundary])
  return (
    <DetailError
      message={error.message || "Unable to load task"}
      onRetry={() => void router.invalidate()}
    />
  )
}

function TaskDetailsPage() {
  const { taskId } = Route.useParams()
  return (
    <CanView a="Task">
      <TaskDetails taskId={taskId} />
    </CanView>
  )
}
