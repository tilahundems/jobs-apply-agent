import { useSuspenseQuery } from "@tanstack/react-query"
import type { ColumnVisibilityState } from "@tanstack/react-table"
import { useTable } from "@tanstack/react-table"
import { UsersIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { EmptyState } from "@/components/empty-state"
import { DataTable, dataTableFeatures } from "@/components/table/data-table"
import { filterRecords } from "@/components/table/list-filters"
import { TableHeader } from "@/components/table/table-header"
import { useTenantMemberManager } from "./use-tenant-member-manager"
import { usersQueryOptions } from "./users-api"
import { UsersForm } from "./users-form"
import {
  createUsersTableColumns,
  readUserField,
  userTableSearch,
} from "./users-table-columns"

const columns = createUsersTableColumns()
const multiTenancy = import.meta.env.VITE_MULTI_TENANCY === "true"

export function UsersTable() {
  const { data } = useSuspenseQuery(usersQueryOptions)
  const canManageMembers = useTenantMemberManager()
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibilityState>({})
  const list = userTableSearch.useTableSearch()
  const rows = useMemo(
    () =>
      filterRecords(data, {
        search: list.search,
        rules: list.rules,
        fields: userTableSearch.fields,
        read: readUserField,
        searchText: (user) => user.name,
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
        icon={UsersIcon}
        title="No Users Yet"
        description={
          multiTenancy
            ? "Invite someone to join this organization."
            : "You haven't added anyone yet. Get started by creating the first user."
        }
        create={
          canManageMembers
            ? {
                label: multiTenancy ? "Invite member" : "Add User",
                subject: "User",
                form: (open, onOpenChange) => (
                  <UsersForm
                    open={open}
                    onOpenChange={onOpenChange}
                    showTrigger={false}
                  />
                ),
              }
            : undefined
        }
      />
    )

  return (
    <div className="flex w-full flex-col justify-start gap-3">
      <TableHeader
        table={table}
        label="Users"
        searchLabel="Search users by name"
        clearLabel="Clear User Search"
        search={list.search}
        onSearch={list.setSearch}
        filters={{
          fields: userTableSearch.fields,
          applied: list.rules,
          onApply: list.setRules,
        }}
      >
        <UsersForm />
      </TableHeader>
      <DataTable table={table} />
    </div>
  )
}
