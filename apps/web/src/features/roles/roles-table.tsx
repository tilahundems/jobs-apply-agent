import { useSuspenseQuery } from "@tanstack/react-query"
import type { ColumnVisibilityState } from "@tanstack/react-table"
import { useTable } from "@tanstack/react-table"
import { ShieldIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { EmptyState } from "@/components/empty-state"
import { DataTable, dataTableFeatures } from "@/components/table/data-table"
import { filterRecords } from "@/components/table/list-filters"
import { TableHeader } from "@/components/table/table-header"
import { workspaceRolesQueryOptions } from "./roles-api"
import { RolesForm } from "./roles-form"
import {
  createRolesTableColumns,
  readRoleField,
  roleTableSearch,
} from "./roles-table-columns"

const columns = createRolesTableColumns()

export function RolesTable() {
  const { data } = useSuspenseQuery(workspaceRolesQueryOptions)
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibilityState>({})
  const list = roleTableSearch.useTableSearch()
  const rows = useMemo(
    () =>
      filterRecords(data, {
        search: list.search,
        rules: list.rules,
        fields: roleTableSearch.fields,
        read: readRoleField,
        searchText: (role) => role.name,
      }),
    [data, list.search, list.rules]
  )
  const table = useTable({
    features: dataTableFeatures,
    data: rows,
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
  })

  if (data.length === 0)
    return (
      <EmptyState
        icon={ShieldIcon}
        title="No Roles Yet"
        description="You haven't created any roles yet. Get started by creating your first role."
        create={{
          label: "Add Role",
          subject: "Role",
          form: (open, onOpenChange) => (
            <RolesForm
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
        label="Roles"
        searchLabel="Search roles by name"
        clearLabel="Clear Role Search"
        search={list.search}
        onSearch={list.setSearch}
        filters={{
          fields: roleTableSearch.fields,
          applied: list.rules,
          onApply: list.setRules,
        }}
      >
        <RolesForm />
      </TableHeader>
      <DataTable table={table} />
    </div>
  )
}
