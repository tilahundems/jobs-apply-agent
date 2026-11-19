import { Link } from "@tanstack/react-router"
import { createColumnHelper } from "@tanstack/react-table"
import { DataTableColumnHeader } from "@/components/table/column-header"
import { createTableSearch } from "@/components/table/create-table-search"
import type { dataTableFeatures } from "@/components/table/data-table"
import { RowActions } from "@/components/table/row-actions"
import { formatRecordDate } from "@/lib/format"
import { TaskPriorityBadge, TaskStatusBadge } from "./task-values"
import type { Task } from "./tasks-api"
import { TasksDeleteDialog } from "./tasks-delete-dialog"
import { TasksForm } from "./tasks-form"

/** The Tasks list's URL state; the server searches, filters and sorts. */
export const taskTableSearch = createTableSearch({
  fields: [
    { value: "title", label: "Title" },
    { value: "project", label: "Project", placeholder: "Enter project name…" },
    { value: "status", label: "Status", placeholder: "Enter status…" },
    { value: "priority", label: "Priority", placeholder: "Enter priority…" },
    {
      value: "assignee",
      label: "Assignee",
      placeholder: "Enter assignee name…",
    },
    { value: "dueDate", label: "Due", kind: "date" },
    { value: "createdAt", label: "Created", kind: "date" },
  ],
  sortFields: [
    "title",
    "project",
    "status",
    "priority",
    "assignee",
    "dueDate",
    "createdAt",
  ],
})

const columnHelper = createColumnHelper<typeof dataTableFeatures, Task>()

export function TaskRowActions({ task }: { task: Task }) {
  return (
    <RowActions
      subject="Task"
      edit={(open, onOpenChange) => (
        <TasksForm task={task} open={open} onOpenChange={onOpenChange} />
      )}
      remove={(open, onOpenChange) => (
        <TasksDeleteDialog
          task={task}
          open={open}
          onOpenChange={onOpenChange}
        />
      )}
    />
  )
}

export function createTasksTableColumns() {
  return columnHelper.columns([
    columnHelper.accessor("title", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Title" />
      ),
      cell: ({ row }) => (
        <Link
          to="/tasks/$taskId"
          params={{ taskId: row.original.id }}
          className="rounded-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          {row.original.title}
        </Link>
      ),
      enableHiding: false,
    }),
    columnHelper.accessor("project", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Project" />
      ),
      cell: ({ row }) => {
        if (row.original.project == null) {
          return <span className="text-muted-foreground">—</span>
        }

        return (
          <Link
            to="/projects/$projectId"
            params={{ projectId: row.original.project.id }}
            className="text-muted-foreground hover:underline"
          >
            {row.original.project.name}
          </Link>
        )
      },
    }),
    columnHelper.accessor("status", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => <TaskStatusBadge status={row.original.status} />,
    }),
    columnHelper.accessor("priority", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Priority" />
      ),
      cell: ({ row }) => <TaskPriorityBadge priority={row.original.priority} />,
    }),
    columnHelper.accessor("assignee", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Assignee" />
      ),
      cell: ({ row }) => {
        if (row.original.assignee == null) {
          return <span className="text-muted-foreground">—</span>
        }

        return (
          <span className="text-muted-foreground">
            {row.original.assignee.name}
          </span>
        )
      },
    }),
    columnHelper.accessor("dueDate", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Due" />
      ),
      cell: ({ row }) => {
        if (!row.original.dueDate) {
          return <span className="text-muted-foreground">—</span>
        }

        return (
          <span className="text-muted-foreground">
            {formatRecordDate(row.original.dueDate)}
          </span>
        )
      },
    }),
    columnHelper.accessor("createdAt", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatRecordDate(row.original.createdAt)}
        </span>
      ),
    }),
    columnHelper.display({
      id: "actions",
      cell: ({ row }) => <TaskRowActions task={row.original} />,
    }),
  ])
}
