import { createColumnHelper } from "@tanstack/react-table"
import { createTableSearch } from "@/components/table/create-table-search"
import type { dataTableFeatures } from "@/components/table/data-table"
import { RowActions } from "@/components/table/row-actions"
import { Badge } from "@/components/ui/badge"
import { formatRecordDate } from "@/lib/format"
import type { Role } from "./roles-api"
import { RolesDeleteDialog } from "./roles-delete-dialog"
import { RolesForm } from "./roles-form"
import { hasManageAll } from "./roles-permissions"

/** The Roles list's URL state; roles load in full and filter in the browser. */
export const roleTableSearch = createTableSearch({
  fields: [
    { value: "name", label: "Name" },
    { value: "key", label: "Key" },
    { value: "description", label: "Description" },
    { value: "createdAt", label: "Created", kind: "date" },
  ],
})

export function readRoleField(role: Role, field: string) {
  return field === "description"
    ? (role.description ?? "")
    : role[field as keyof Role]
}

const columnHelper = createColumnHelper<typeof dataTableFeatures, Role>()

function permissionSummary(role: Role) {
  if (hasManageAll(role.permissions)) {
    return "Full access"
  }

  const count = role.permissions.length

  if (count === 0) {
    return "No permissions"
  }

  return count === 1 ? "1 permission" : `${count} permissions`
}

export function createRolesTableColumns() {
  return columnHelper.columns([
    columnHelper.accessor("name", {
      header: "Name",
      cell: ({ row }) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{row.original.name}</span>
          {row.original.isSystem ? (
            <Badge variant="secondary">System</Badge>
          ) : null}
        </span>
      ),
      enableHiding: false,
    }),
    columnHelper.accessor("key", {
      header: "Key",
      cell: ({ row }) => (
        <span className="font-mono text-muted-foreground">
          {row.original.key}
        </span>
      ),
    }),
    columnHelper.accessor((row) => row.description ?? "", {
      id: "description",
      header: "Description",
      cell: ({ row }) => {
        const description = row.original.description

        if (description == null || description.length === 0) {
          return <span className="text-muted-foreground">—</span>
        }

        return (
          <span className="line-clamp-2 max-w-80 text-muted-foreground">
            {description}
          </span>
        )
      },
    }),
    columnHelper.accessor((row) => permissionSummary(row), {
      id: "permissions",
      header: "Permissions",
      cell: ({ row }) => (
        <Badge variant="outline">{permissionSummary(row.original)}</Badge>
      ),
    }),
    columnHelper.accessor("userCount", {
      header: "Users",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.userCount}</span>
      ),
    }),
    columnHelper.accessor("createdAt", {
      header: "Created",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatRecordDate(row.original.createdAt)}
        </span>
      ),
    }),
    columnHelper.display({
      id: "actions",
      cell: ({ row }) => {
        const role = row.original
        return (
          <RowActions
            subject="Role"
            edit={(open, onOpenChange) => (
              <RolesForm role={role} open={open} onOpenChange={onOpenChange} />
            )}
            // System roles and roles still assigned to users cannot be deleted.
            remove={
              !role.isSystem && role.userCount === 0
                ? (open, onOpenChange) => (
                    <RolesDeleteDialog
                      role={role}
                      open={open}
                      onOpenChange={onOpenChange}
                    />
                  )
                : undefined
            }
          />
        )
      },
    }),
  ])
}
