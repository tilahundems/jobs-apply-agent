import type { ReactTable, RowData } from "@tanstack/react-table"
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  FlexRender,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  tableFeatures,
} from "@tanstack/react-table"
import { useEffect } from "react"
import { getGroupedColumnRowSpans } from "@/components/table/group-rows"
import { DataTablePagination } from "@/components/table/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    datetime: sortFn_datetime,
  },
})

export type DataTableInstance<TData extends RowData = RowData> = ReactTable<
  typeof dataTableFeatures,
  TData
>

export function DataTable<TData extends RowData>({
  table,
  groupBy,
  paginate = true,
  verticalBorders,
  className,
}: {
  table: DataTableInstance<TData>
  groupBy?: string
  paginate?: boolean
  verticalBorders?: boolean
  className?: string
}) {
  const rows = paginate
    ? table.getRowModel().rows
    : table.getPrePaginatedRowModel().rows
  const groupSpans = groupBy
    ? getGroupedColumnRowSpans(rows, groupBy)
    : undefined
  const pageIndex = table.state.pagination.pageIndex
  const pageCount = table.getPageCount()
  const hasSelectColumn = table
    .getAllColumns()
    .some((column) => column.id === "select")

  useEffect(() => {
    if (!paginate) return
    if (pageIndex > 0 && pageIndex >= pageCount) {
      table.setPageIndex(Math.max(0, pageCount - 1))
    }
  }, [pageCount, pageIndex, paginate, table])

  return (
    <div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
      <div className="overflow-hidden rounded-md border">
        <Table className={className}>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted()

                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={cn(
                        header.column.id === "select" &&
                          "[&:has([role=checkbox])]:pr-2",
                        header.column.id === groupBy &&
                          "w-auto px-2 text-center",
                        verticalBorders &&
                          header.column.id === groupBy &&
                          "border-r border-muted"
                      )}
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : header.column.getCanSort()
                              ? "none"
                              : undefined
                      }
                    >
                      {header.isPlaceholder ? null : (
                        <FlexRender header={header} />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody
            className={
              groupBy || !hasSelectColumn
                ? undefined
                : "**:data-[slot=table-cell]:first:w-8"
            }
          >
            {rows.length ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => {
                    if (groupBy && cell.column.id === groupBy && groupSpans) {
                      const span = groupSpans.get(row.id) ?? 1
                      if (span === 0) return null

                      return (
                        <TableCell
                          key={cell.id}
                          rowSpan={span}
                          className={cn(
                            "w-auto px-2 text-center",
                            verticalBorders && "border-r"
                          )}
                        >
                          <FlexRender cell={cell} />
                        </TableCell>
                      )
                    }

                    return (
                      <TableCell
                        key={cell.id}
                        className={
                          cell.column.id === "select"
                            ? "[&:has([role=checkbox])]:pr-2"
                            : undefined
                        }
                      >
                        <FlexRender cell={cell} />
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getAllColumns().length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {paginate ? <DataTablePagination table={table} /> : null}
    </div>
  )
}
