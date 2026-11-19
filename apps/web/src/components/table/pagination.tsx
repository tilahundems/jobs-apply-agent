import type { RowData } from "@tanstack/react-table"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react"
import type { DataTableInstance } from "@/components/table/data-table"
import { Label } from "@/components/ui/label"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useI18n } from "@/features/i18n/i18n-provider"
import { PAGE_SIZES } from "@/lib/table-search-params"

export function DataTablePagination<TData extends RowData>({
  table,
}: {
  table: DataTableInstance<TData>
}) {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-between px-4">
      <div className="hidden flex-1 lg:flex" />
      <div className="flex w-full items-center gap-8 lg:w-fit">
        <div className="hidden items-center gap-2 lg:flex">
          <Label htmlFor="rows-per-page" className="text-sm font-medium">
            {t("Rows per page")}
          </Label>
          <Select
            value={`${table.state.pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value))
            }}
            items={PAGE_SIZES.map((pageSize) => ({
              label: `${pageSize}`,
              value: `${pageSize}`,
            }))}
          >
            <SelectTrigger size="sm" className="w-20" id="rows-per-page">
              <SelectValue placeholder={table.state.pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              <SelectGroup>
                {PAGE_SIZES.map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-fit items-center justify-center text-sm font-medium">
          {t("Page")} {table.state.pagination.pageIndex + 1} {t("of")}{" "}
          {Math.max(1, table.getPageCount())}
        </div>
        <Pagination className="mx-0 ml-auto w-auto lg:ml-0">
          <PaginationContent className="gap-2">
            <PaginationItem className="hidden lg:block">
              <PaginationLink
                size="icon"
                variant="outline"
                className="size-8"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                aria-label={t("Go To First Page")}
              >
                <span className="sr-only">{t("Go To First Page")}</span>
                <ChevronsLeftIcon />
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink
                size="icon"
                variant="outline"
                className="size-8"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label={t("Go To Previous Page")}
              >
                <span className="sr-only">{t("Go To Previous Page")}</span>
                <ChevronLeftIcon />
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink
                size="icon"
                variant="outline"
                className="size-8"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label={t("Go To Next Page")}
              >
                <span className="sr-only">{t("Go To Next Page")}</span>
                <ChevronRightIcon />
              </PaginationLink>
            </PaginationItem>
            <PaginationItem className="hidden lg:block">
              <PaginationLink
                size="icon"
                variant="outline"
                className="size-8"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
                aria-label={t("Go To Last Page")}
              >
                <span className="sr-only">{t("Go To Last Page")}</span>
                <ChevronsRightIcon />
              </PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  )
}
