import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { PlusIcon } from "lucide-react"
import { useState } from "react"
import { DetailActions } from "@/components/detail-page"
import { RecordDetails } from "@/components/record-details"
import type { RelatedColumn } from "@/components/table/related-records-table"
import { RelatedRecordsTable } from "@/components/table/related-records-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Can, useAppAbility } from "@/features/authz"
import {
  TaskAssignee,
  TaskPriorityBadge,
  TaskStatusBadge,
} from "@/features/tasks/task-values"
import type { Task } from "@/features/tasks/tasks-api"
import { tasksQueryOptions } from "@/features/tasks/tasks-api"
import { TasksForm } from "@/features/tasks/tasks-form"
import { TaskRowActions } from "@/features/tasks/tasks-table-columns"
import { formatRecordDate } from "@/lib/format"
import { projectQueryOptions } from "./projects-api"
import { ProjectsDeleteDialog } from "./projects-delete-dialog"
import { ProjectsForm } from "./projects-form"

const taskColumns: RelatedColumn<Task>[] = [
  {
    id: "title",
    label: "Task",
    text: (task) => task.title,
    cell: (task) => (
      <Link
        to="/tasks/$taskId"
        params={{ taskId: task.id }}
        className="font-medium hover:underline"
      >
        {task.title}
      </Link>
    ),
    hideable: false,
  },
  {
    id: "status",
    label: "Status",
    text: (task) => task.status,
    cell: (task) => <TaskStatusBadge status={task.status} />,
  },
  {
    id: "priority",
    label: "Priority",
    text: (task) => task.priority,
    cell: (task) => <TaskPriorityBadge priority={task.priority} />,
  },
  {
    id: "assignee",
    label: "Assignee",
    text: (task) => task.assignee?.name ?? "",
    cell: (task) => <TaskAssignee assignee={task.assignee} />,
  },
  {
    id: "dueDate",
    label: "Due date",
    text: (task) => task.dueDate ?? "",
    filterKind: "date",
    cell: (task) => formatRecordDate(task.dueDate),
  },
  {
    id: "actions",
    label: "Actions",
    text: () => "",
    filterable: false,
    cell: (task) => <TaskRowActions task={task} />,
  },
]
export function ProjectDetails({ projectId }: { projectId: string }) {
  const { data: project } = useSuspenseQuery(projectQueryOptions(projectId))
  const ability = useAppAbility()
  const canReadTasks = ability.can("read", "Task")
  const canReadTags = ability.can("read", "Tag")
  const {
    data: tasks = [],
    error: tasksError,
    isPending: tasksPending,
  } = useQuery({ ...tasksQueryOptions, enabled: canReadTasks })
  const projectTasks = tasks.filter((task) => task.projectId === project.id)
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const done = projectTasks.filter((task) => task.status === "done").length

  const details = {
    title: project.name,
    badges:
      canReadTags && project.tags.length
        ? project.tags.map((tag) => (
            <Badge key={tag.id} variant="outline">
              <span
                className="mr-1 size-2 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              {tag.label}
            </Badge>
          ))
        : undefined,
    description: project.description,
    actions: (
      <DetailActions
        kind="Project"
        subject="Project"
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
      />
    ),
    fields: [
      ...(canReadTasks
        ? [
            {
              label: "Tasks",
              value: tasksPending
                ? "Loading…"
                : tasksError
                  ? "Unable to load"
                  : `${projectTasks.length} total`,
            },
            {
              label: "Completed",
              value: tasksPending
                ? "Loading…"
                : tasksError
                  ? "Unable to load"
                  : `${done} of ${projectTasks.length}`,
            },
          ]
        : []),
      { label: "Created", value: formatRecordDate(project.createdAt) },
      { label: "Updated", value: formatRecordDate(project.updatedAt) },
    ],
  }

  return (
    <>
      <RecordDetails
        key={project.id}
        {...details}
        tabs={[
          ...(canReadTasks
            ? [
                {
                  value: "tasks",
                  label: "Tasks",
                  content: tasksError ? (
                    <p role="alert" className="px-4 lg:px-6">
                      Unable to load tasks
                    </p>
                  ) : tasksPending ? (
                    <p className="px-4 lg:px-6">Loading tasks…</p>
                  ) : (
                    <RelatedRecordsTable
                      label="Tasks"
                      records={projectTasks}
                      columns={taskColumns}
                      add={
                        <Can I="create" a="Task">
                          <Button
                            size="sm"
                            onClick={() => setAddTaskOpen(true)}
                          >
                            <PlusIcon data-icon="inline-start" />
                            Add Task
                          </Button>
                        </Can>
                      }
                    />
                  ),
                },
              ]
            : []),
        ]}
      />
      <ProjectsForm
        project={project}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <ProjectsDeleteDialog
        project={project}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => void navigate({ to: "/projects" })}
      />
      <TasksForm
        open={addTaskOpen}
        onOpenChange={setAddTaskOpen}
        showTrigger={false}
        defaultProjectId={project.id}
      />
    </>
  )
}
