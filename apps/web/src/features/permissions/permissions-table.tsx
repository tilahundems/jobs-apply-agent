import { useSuspenseQuery } from "@tanstack/react-query"
import type { ColumnVisibilityState, SortingState } from "@tanstack/react-table"
import { useTable } from "@tanstack/react-table"
import { KeyRoundIcon, PlusIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { EmptyState } from "@/components/empty-state"
import { DataTable, dataTableFeatures } from "@/components/table/data-table"
import { filterRecords } from "@/components/table/list-filters"
import { TableHeader } from "@/components/table/table-header"
import { Button } from "@/components/ui/button"
import { Can } from "@/features/authz"
import { useI18n } from "@/features/i18n/i18n-provider"
import type { PermissionOption } from "./permissions-api"
import {
  permissionOptionsQueryOptions,
  permissionsQueryOptions,
} from "./permissions-api"
import { PermissionsForm } from "./permissions-form"
import {
  createPermissionsTableColumns,
  permissionSearchText,
  permissionTableSearch,
  readPermissionField,
} from "./permissions-table-columns"

const columns = createPermissionsTableColumns()

/** Rows stay grouped by subject; other sorts apply within each subject. */
function withSubjectGrouping(sorting: SortingState): SortingState {
  const subject = sorting.find((item) => item.id === "subject")
  return [
    { id: "subject", desc: subject?.desc ?? false },
    ...sorting.filter((item) => item.id !== "subject"),
  ]
}

function CreatePermission({
  options,
  actions,
}: {
  options: PermissionOption[]
  actions: string[]
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  return (
    <Can I="create" a="Permission">
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon />
        <span className="hidden lg:inline">{t("Add Permission")}</span>
      </Button>
      {open ? (
        <PermissionsForm
          options={options}
          actions={actions}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </Can>
  )
}

export function PermissionsTable() {
  const { data } = useSuspenseQuery(permissionsQueryOptions)
  const options = useSuspenseQuery(permissionOptionsQueryOptions)
  const actions = data.map((item) => item.action)
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibilityState>({})
  const list = permissionTableSearch.useTableSearch()
  const rows = useMemo(
    () =>
      filterRecords(data, {
        search: list.search,
        rules: list.rules,
        fields: permissionTableSearch.fields,
        read: readPermissionField,
        searchText: permissionSearchText,
      }),
    [data, list.search, list.rules]
  )
  const table = useTable({
    features: dataTableFeatures,
    data: rows,
    columns,
    state: {
      sorting: withSubjectGrouping(list.sorting),
      columnVisibility,
    },
    getRowId: (row) => row.id,
    onSortingChange: list.setSorting,
    onColumnVisibilityChange: setColumnVisibility,
  })

  if (data.length === 0)
    return (
      <EmptyState
        icon={KeyRoundIcon}
        title="No Permissions Yet"
        description="Add your first permission, then select it when creating or editing a role."
        create={{
          label: "Add Permission",
          subject: "Permission",
          form: (open, onOpenChange) =>
            open ? (
              <PermissionsForm
                options={options.data}
                actions={actions}
                onClose={() => onOpenChange(false)}
              />
            ) : null,
        }}
      />
    )

  return (
    <div className="flex w-full flex-col justify-start gap-3">
      <TableHeader
        table={table}
        label="Permissions"
        searchLabel="Search permissions"
        searchPlaceholder="Search subjects, actions or conditions…"
        clearLabel="Clear Permission Search"
        search={list.search}
        onSearch={list.setSearch}
        filters={{
          fields: permissionTableSearch.fields,
          applied: list.rules,
          onApply: list.setRules,
        }}
      >
        <CreatePermission options={options.data} actions={actions} />
      </TableHeader>
      <DataTable
        table={table}
        groupBy="subject"
        paginate={false}
        verticalBorders
      />
    </div>
  )
}
