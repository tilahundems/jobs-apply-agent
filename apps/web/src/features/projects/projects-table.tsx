import { useSuspenseQuery } from "@tanstack/react-query"
import type { ColumnVisibilityState } from "@tanstack/react-table"
import { useTable } from "@tanstack/react-table"
import { useState } from "react"
import { DataTable, dataTableFeatures } from "@/components/table/data-table"
import { TableHeader } from "@/components/table/table-header"
import { projectPageQueryOptions } from "./projects-api"
import { ProjectsForm } from "./projects-form"
import {
  createProjectsTableColumns,
  projectTableSearch,
} from "./projects-table-columns"

const columns = createProjectsTableColumns()

export function ProjectsTable() {
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibilityState>({})
  const list = projectTableSearch.useTableSearch()
  const { data: page } = useSuspenseQuery(projectPageQueryOptions(list.query))
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
    // The filtered total, so pagination reflects the search and filters.
    rowCount: page.total,
  })

  return (
    <div className="flex w-full flex-col justify-start gap-3">
      <TableHeader
        table={table}
        label="Projects"
        searchLabel="Search projects by name"
        clearLabel="Clear Project Search"
        search={list.search}
        onSearch={list.setSearch}
        filters={{
          fields: projectTableSearch.fields,
          applied: list.rules,
          onApply: list.setRules,
        }}
        columnLabels={{ description: "Description", createdAt: "Created" }}
      >
        <ProjectsForm />
      </TableHeader>
      <DataTable table={table} />
    </div>
  )
}
