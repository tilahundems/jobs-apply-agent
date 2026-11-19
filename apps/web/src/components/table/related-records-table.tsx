import type {
  ColumnVisibilityState,
  PaginationState,
  SortingState,
} from "@tanstack/react-table"
import { createColumnHelper, useTable } from "@tanstack/react-table"
import { DownloadIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useMemo, useState } from "react"
import { DataTable, dataTableFeatures } from "@/components/table/data-table"
import type { FilterRule } from "@/components/table/list-filters"
import { filterRecords } from "@/components/table/list-filters"
import { TableHeader } from "@/components/table/table-header"
import { Button } from "@/components/ui/button"

export type RelatedColumn<T> = {
  id: string
  label: string
  cell: (record: T) => ReactNode
  text: (record: T) => string
  hideable?: boolean
  filterable?: boolean
  filterKind?: "text" | "date"
}

function csvCell(value: string) {
  const safe = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}

export function RelatedRecordsTable<T extends { id: string }>({
  label,
  records,
  columns,
  add,
}: {
  label: string
  records: T[]
  columns: RelatedColumn<T>[]
  add?: ReactNode
}) {
  const [search, setSearch] = useState("")
  const [rules, setRules] = useState<FilterRule[]>([])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibilityState>({})
  const filterFields = useMemo(
    () =>
      columns
        .filter((column) => column.filterable !== false)
        .map((column) => ({
          value: column.id,
          label: column.label,
          kind: column.filterKind ?? "text",
        })),
    [columns]
  )
  const filtered = useMemo(
    () =>
      filterRecords(records, {
        search,
        rules,
        fields: filterFields,
        read: (record, field) =>
          columns.find(({ id }) => id === field)?.text(record),
        searchText: (record) =>
          columns.map((column) => column.text(record)).join(" "),
      }),
    [records, columns, search, rules, filterFields]
  )
  const tableColumns = useMemo(() => {
    const helper = createColumnHelper<typeof dataTableFeatures, T>()
    return helper.columns(
      columns.map((column) =>
        helper.display({
          id: column.id,
          header: column.label,
          cell: ({ row }) => column.cell(row.original),
          enableHiding: column.hideable ?? true,
        })
      )
    )
  }, [columns])
  const table = useTable({
    features: dataTableFeatures,
    data: filtered,
    columns: tableColumns,
    state: { pagination, sorting, columnVisibility },
    getRowId: (row) => row.id,
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
  })

  function exportCsv() {
    const visible = columns.filter((column) =>
      table.getColumn(column.id)?.getIsVisible()
    )
    const csv = [
      visible.map((column) => csvCell(column.label)).join(","),
      ...filtered.map((record) =>
        visible.map((column) => csvCell(column.text(record))).join(",")
      ),
    ].join("\r\n")
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })
    )
    const link = document.createElement("a")
    link.href = url
    link.download = `${label.toLocaleLowerCase().replaceAll(" ", "-")}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="flex w-full flex-col gap-3" aria-label={label}>
      <TableHeader
        table={table}
        label={label}
        searchLabel={`Search ${label}`}
        searchPlaceholder={`Search ${label.toLocaleLowerCase()}…`}
        clearLabel={`Clear ${label} Search`}
        search={search}
        onSearch={(value) => {
          setSearch(value)
          table.setPageIndex(0)
        }}
        filters={{
          fields: filterFields,
          applied: rules,
          onApply: (nextRules) => {
            setRules(nextRules)
            table.setPageIndex(0)
          },
        }}
        tools={
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <DownloadIcon data-icon="inline-start" />
            Export
          </Button>
        }
      >
        {add}
      </TableHeader>
      <DataTable table={table} />
    </section>
  )
}
