import type { ReactTable, RowData } from "@tanstack/react-table"
import { ChevronDownIcon, Columns3Icon, SearchIcon, XIcon } from "lucide-react"
import type { ReactNode } from "react"
import type { dataTableFeatures } from "@/components/table/data-table"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { useI18n } from "@/features/i18n/i18n-provider"
import type { FilterField, FilterRule } from "./list-filters"
import { TableFilters } from "./table-filters"

/**
 * The toolbar above a list table: search, then filters, `tools` (such as
 * export), column visibility and `children` (the create action). Labels are
 * translation keys.
 */
export function TableHeader<TData extends RowData>({
  table,
  label,
  searchLabel,
  searchPlaceholder = `${searchLabel}…`,
  clearLabel,
  search,
  onSearch,
  filters,
  columnLabels = {},
  tools,
  children,
}: {
  table: ReactTable<typeof dataTableFeatures, TData>
  label: string
  searchLabel: string
  searchPlaceholder?: string
  clearLabel: string
  search: string
  onSearch: (value: string) => void
  filters?: {
    fields: readonly FilterField[]
    applied: FilterRule[]
    onApply: (rules: FilterRule[]) => void
  }
  columnLabels?: Record<string, string>
  tools?: ReactNode
  children?: ReactNode
}) {
  const { t } = useI18n()

  return (
    <div className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
      <search aria-label={t(label)} className="min-w-0 sm:w-80">
        <InputGroup>
          <InputGroupInput
            type="search"
            className="[&::-webkit-search-cancel-button]:appearance-none"
            aria-label={t(searchLabel)}
            placeholder={t(searchPlaceholder)}
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onSearch("")
            }}
          />
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          {search ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label={t(clearLabel)}
                onClick={() => onSearch("")}
              >
                <XIcon aria-hidden="true" />
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
      </search>
      <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
        {filters ? <TableFilters label={label} {...filters} /> : null}
        {tools}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            <Columns3Icon data-icon="inline-start" />
            {t("Columns")}
            <ChevronDownIcon data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuGroup>
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    column.getCanHide() &&
                    (column.accessorFn !== undefined ||
                      typeof column.columnDef.header === "string")
                )
                .map((column) => {
                  const header = column.columnDef.header
                  const name =
                    typeof header === "string"
                      ? header
                      : (columnLabels[column.id] ?? column.id)
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {t(name)}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {children}
      </div>
    </div>
  )
}
