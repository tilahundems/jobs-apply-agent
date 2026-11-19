import { useQuery } from "@tanstack/react-query"
import { createColumnHelper } from "@tanstack/react-table"
import { createTableSearch } from "@/components/table/create-table-search"
import type { dataTableFeatures } from "@/components/table/data-table"
import { RowActions } from "@/components/table/row-actions"
import { Badge } from "@/components/ui/badge"
import { describeConditions, permissionSubjectLabel } from "./conditions"
import type { Permission } from "./permissions-api"
import {
  permissionOptionsQueryOptions,
  permissionsQueryOptions,
} from "./permissions-api"
import { PermissionsDeleteDialog } from "./permissions-delete-dialog"
import { PermissionsForm } from "./permissions-form"

/** The Permissions list's URL filters; permissions load in full. */
export const permissionTableSearch = createTableSearch({
  fields: [
    { value: "subject", label: "Subject" },
    { value: "action", label: "Action" },
    { value: "conditions", label: "Conditions" },
    { value: "roleCount", label: "Roles" },
  ],
})

/** Filter values: the subject's label, a "Deny" action, and condition text. */
export function readPermissionField(permission: Permission, field: string) {
  switch (field) {
    case "subject":
      return [permissionSubjectLabel(permission.subject), permission.subject]
    case "action":
      return permission.inverted
        ? [permission.action, "Deny"]
        : [permission.action]
    case "conditions":
      return [
        describeConditions(permission.conditions),
        permission.fields.length
          ? `Fields: ${permission.fields.join(", ")}`
          : "",
      ]
    case "roleCount":
      return String(permission.roleCount)
    default:
      return ""
  }
}

export function permissionSearchText(permission: Permission) {
  return `${permissionSubjectLabel(permission.subject)} ${permission.action} ${permission.inverted ? "deny" : ""} ${describeConditions(permission.conditions)}`
}

/** Loads the form's options only while editing. */
function PermissionEditDialog({
  permission,
  open,
  onClose,
}: {
  permission: Permission
  open: boolean
  onClose: () => void
}) {
  const options = useQuery({ ...permissionOptionsQueryOptions, enabled: open })
  const catalog = useQuery({ ...permissionsQueryOptions, enabled: open })
  if (!open || !options.data || !catalog.data) return null
  return (
    <PermissionsForm
      permission={permission}
      options={options.data}
      actions={catalog.data.map((item) => item.action)}
      onClose={onClose}
    />
  )
}

const columnHelper = createColumnHelper<typeof dataTableFeatures, Permission>()

export function createPermissionsTableColumns() {
  return columnHelper.columns([
    columnHelper.accessor("subject", {
      header: "Subject",
      sortFn: (rowA, rowB) =>
        permissionSubjectLabel(rowA.original.subject).localeCompare(
          permissionSubjectLabel(rowB.original.subject)
        ),
      cell: ({ row }) => (
        <span className="font-medium">
          {permissionSubjectLabel(row.original.subject)}
        </span>
      ),
      enableHiding: false,
    }),
    columnHelper.accessor("action", {
      header: "Action",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{row.original.action}</Badge>
          {row.original.inverted ? <Badge variant="outline">Deny</Badge> : null}
        </div>
      ),
    }),
    columnHelper.accessor((row) => describeConditions(row.conditions), {
      id: "conditions",
      header: "Conditions",
      cell: ({ row }) => (
        <div className="max-w-md whitespace-normal">
          <p className="text-sm text-muted-foreground">
            {describeConditions(row.original.conditions)}
          </p>
          {row.original.fields.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Fields: {row.original.fields.join(", ")}
            </p>
          ) : null}
        </div>
      ),
    }),
    columnHelper.accessor("roleCount", {
      header: "Roles",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.roleCount}</span>
      ),
    }),
    columnHelper.display({
      id: "actions",
      cell: ({ row }) => (
        <RowActions
          subject="Permission"
          record={row.original}
          edit={(open, onOpenChange) => (
            <PermissionEditDialog
              permission={row.original}
              open={open}
              onClose={() => onOpenChange(false)}
            />
          )}
          remove={(open, onOpenChange) => (
            <PermissionsDeleteDialog
              permission={row.original}
              open={open}
              onOpenChange={onOpenChange}
            />
          )}
        />
      ),
    }),
  ])
}
