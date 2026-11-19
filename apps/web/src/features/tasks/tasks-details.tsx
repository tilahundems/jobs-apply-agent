import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { ListTodoIcon } from "lucide-react"
import { useState } from "react"
import { DetailActions, DetailEmpty } from "@/components/detail-page"
import { RecordDetails } from "@/components/record-details"
import { Button, buttonVariants } from "@/components/ui/button"
import { Can, useAppAbility } from "@/features/authz"
import { formatRecordDate } from "@/lib/format"
import { TaskAssignee, TaskPriorityBadge, TaskStatusBadge } from "./task-values"
import type { Task } from "./tasks-api"
import { tasksQueryOptions } from "./tasks-api"
import { TasksDeleteDialog } from "./tasks-delete-dialog"
import { TasksForm } from "./tasks-form"

export function TaskDetailsNotFound() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <DetailEmpty
        icon={ListTodoIcon}
        title="Task not found"
        description="This task may have been deleted, or the link is incorrect."
        action={
          <Link to="/tasks" className={buttonVariants({ variant: "outline" })}>
            Back To Tasks
          </Link>
        }
      />
    </div>
  )
}

export function TaskDetails({ taskId }: { taskId: string }) {
  const { data: tasks } = useSuspenseQuery(tasksQueryOptions)
  const task = tasks.find((item) => item.id === taskId)
  return task ? (
    <TaskDetailsRecord key={task.id} task={task} />
  ) : (
    <TaskDetailsNotFound />
  )
}

function TaskDetailsRecord({ task }: { task: Task }) {
  const navigate = useNavigate()
  const ability = useAppAbility()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const canReadProject = ability.can("read", "Project")
  const canReadUser = ability.can("read", "User")
  const details = {
    title: task.title,
    badges: (
      <>
        <TaskStatusBadge status={task.status} />
        <TaskPriorityBadge priority={task.priority} />
      </>
    ),
    description: task.description?.trim() || undefined,
    actions: (
      <DetailActions
        kind="Task"
        subject="Task"
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
      />
    ),
    fields: [
      ...(!task.description?.trim()
        ? [
            {
              label: "Description",
              value: (
                <Can I="update" a="Task">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditOpen(true)}
                  >
                    Add Description
                  </Button>
                </Can>
              ),
            },
          ]
        : []),
      { label: "Status", value: <TaskStatusBadge status={task.status} /> },
      {
        label: "Priority",
        value: <TaskPriorityBadge priority={task.priority} />,
      },
      {
        label: "Assignee",
        value:
          canReadUser || !task.assignee ? (
            <span className="flex flex-col gap-1">
              <TaskAssignee assignee={task.assignee} />
              {task.assignee ? (
                <span className="text-muted-foreground">
                  {task.assignee.email}
                </span>
              ) : null}
            </span>
          ) : (
            "Unavailable"
          ),
      },
      {
        label: "Due date",
        value: task.dueDate ? formatRecordDate(task.dueDate) : "Not set",
      },
      {
        label: "Project",
        value:
          task.project && canReadProject ? (
            <Link
              to="/projects/$projectId"
              params={{ projectId: task.project.id }}
              className="hover:underline"
            >
              {task.project.name}
            </Link>
          ) : task.projectId ? (
            "Unavailable"
          ) : (
            <span className="flex items-center gap-3">
              <span>No project assigned</span>{" "}
              <Can I="update" a="Task">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditOpen(true)}
                >
                  Assign project
                </Button>
              </Can>
            </span>
          ),
      },
      { label: "Created", value: formatRecordDate(task.createdAt) },
      { label: "Updated", value: formatRecordDate(task.updatedAt) },
    ],
  }

  return (
    <>
      <RecordDetails {...details} />
      <TasksForm task={task} open={editOpen} onOpenChange={setEditOpen} />
      <TasksDeleteDialog
        task={task}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => void navigate({ to: "/tasks" })}
      />
    </>
  )
}
