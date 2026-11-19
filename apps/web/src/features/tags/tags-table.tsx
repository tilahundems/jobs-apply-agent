import { useSuspenseQuery } from "@tanstack/react-query"
import type { ColumnVisibilityState } from "@tanstack/react-table"
import { useTable } from "@tanstack/react-table"
import { TagsIcon } from "lucide-react"
import { useState } from "react"
import { EmptyState } from "@/components/empty-state"
import { DataTable, dataTableFeatures } from "@/components/table/data-table"
import { TableHeader } from "@/components/table/table-header"
import { tagPageQueryOptions } from "./tags-api"
import { TagsForm } from "./tags-form"
import { createTagsTableColumns, tagTableSearch } from "./tags-table-columns"

const columns = createTagsTableColumns()

export function TagsTable() {
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibilityState>({})
  const list = tagTableSearch.useTableSearch()
  const { data: page } = useSuspenseQuery(tagPageQueryOptions(list.query))
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
        icon={TagsIcon}
        title="No Tags Yet"
        description="You haven't created any tags yet. Get started by creating your first tag."
        create={{
          label: "Add Tag",
          subject: "Tag",
          form: (open, onOpenChange) => (
            <TagsForm
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
        label="Tags"
        searchLabel="Search tags by label"
        clearLabel="Clear Tag Search"
        search={list.search}
        onSearch={list.setSearch}
        filters={{
          fields: tagTableSearch.fields,
          applied: list.rules,
          onApply: list.setRules,
        }}
        columnLabels={{ color: "Color", createdAt: "Created" }}
      >
        <TagsForm />
      </TableHeader>
      <DataTable table={table} />
    </div>
  )
}
