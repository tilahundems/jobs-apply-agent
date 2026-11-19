import { useSuspenseQuery } from "@tanstack/react-query"
import type { ColumnVisibilityState } from "@tanstack/react-table"
import { useTable } from "@tanstack/react-table"
import { ListTodoIcon } from "lucide-react"
import { useState } from "react"
import { EmptyState } from "@/components/empty-state"
import { DataTable, dataTableFeatures } from "@/components/table/data-table"
import { TableHeader } from "@/components/table/table-header"
import { taskPageQueryOptions } from "./tasks-api"
import { TasksForm } from "./tasks-form"
import { createTasksTableColumns, taskTableSearch } from "./tasks-table-columns"

const columns = createTasksTableColumns()

export function TasksTable() {
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibilityState>({})
  const list = taskTableSearch.useTableSearch()
  const { data: page } = useSuspenseQuery(taskPageQueryOptions(list.query))
  const table = useTable({
    features: dataTableFeatures,
    data: page.items,
    columns,
    state: {
      sorting: list.sorting,
      columnVisibility,
      pagination: list.pagination,
    },
    getRowId: (row) => row.id,
    onSortingChange: list.setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: list.setPagination,
    manualPagination: true,
    manualSorting: true,
    rowCount: page.total,
  })

  // Keep the header visible when a search or filter matches nothing.
  if (page.total === 0 && !list.search && list.rules.length === 0)
    return (
      <EmptyState
        icon={ListTodoIcon}
        title="No Tasks Yet"
        description="You haven't created any tasks yet. Get started by creating your first task."
        create={{
          label: "Add Task",
          subject: "Task",
          form: (open, onOpenChange) => (
            <TasksForm
              open={open}
              onOpenChange={onOpenChange}
              showTrigger={false}
            />
          ),
        }}
      />
    )

  return (
    <div className="flex w-full flex-col justify-start gap-3">
      <TableHeader
        table={table}
        label="Tasks"
        searchLabel="Search tasks by title"
        clearLabel="Clear Task Search"
        search={list.search}
        onSearch={list.setSearch}
        filters={{
          fields: taskTableSearch.fields,
          applied: list.rules,
          onApply: list.setRules,
        }}
        columnLabels={{
          project: "Project",
          status: "Status",
          priority: "Priority",
          assignee: "Assignee",
          dueDate: "Due",
          createdAt: "Created",
        }}
      >
        <TasksForm />
      </TableHeader>
      <DataTable table={table} />
    </div>
  )
}
