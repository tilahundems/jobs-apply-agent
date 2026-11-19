import { useQueryClient } from "@tanstack/react-query"
import {
  ConfirmDeleteDialog,
  RecordName,
} from "@/components/confirm-delete-dialog"
import type { Task } from "./tasks-api"
import { deleteTask, tasksQueryOptions } from "./tasks-api"

export function TasksDeleteDialog({
  task,
  open,
  onOpenChange,
  onDeleted,
}: {
  task: Task
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}) {
  const queryClient = useQueryClient()
  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete Task"
      description={
        <>
          This will delete <RecordName>{task.title}</RecordName> from your
          tasks.
        </>
      }
      success="Task deleted"
      successDescription={task.title}
      failure="Unable to delete task"
      onConfirm={async () => {
        await deleteTask(task.id)
        await queryClient.invalidateQueries(tasksQueryOptions)
      }}
      onDone={onDeleted}
    />
  )
}
