import type { Column, RowData } from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useI18n } from "@/features/i18n/i18n-provider"
import { cn } from "@/lib/utils"
import type { dataTableFeatures } from "./data-table"

export function DataTableColumnHeader<TData extends RowData, TValue = unknown>({
  column,
  title,
  className,
}: {
  column: Column<typeof dataTableFeatures, TData, TValue>
  title: string
  className?: string
}) {
  const { t } = useI18n()
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{t(title)}</div>
  }

  const sorted = column.getIsSorted()
  const SortIcon =
    sorted === "desc"
      ? ArrowDownIcon
      : sorted === "asc"
        ? ArrowUpIcon
        : ChevronsUpDownIcon

  return (
    <Button
      variant="ghost"
      className={cn("-ml-2 text-sm font-medium", className)}
      onClick={column.getToggleSortingHandler()}
      aria-label={
        sorted === "asc"
          ? `Sort By ${title} Descending`
          : sorted === "desc"
            ? `Clear ${title} Sort`
            : `Sort By ${title} Ascending`
      }
    >
      {t(title)}
      <SortIcon
        data-icon="inline-end"
        className="size-3 text-muted-foreground"
      />
    </Button>
  )
}
