import { createColumnHelper } from "@tanstack/react-table"
import { EllipsisVerticalIcon, SquarePenIcon, Trash2Icon } from "lucide-react"
import * as React from "react"

import { createTableSearch } from "@/components/table/create-table-search"
import type { dataTableFeatures } from "@/components/table/data-table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Can, useCurrentUserId } from "@/features/authz"
import { formatRecordDate, initials } from "@/lib/format"
import { MemberRemoveDialog } from "./member-remove-dialog"
import { useTenantMemberManager } from "./use-tenant-member-manager"
import type { User } from "./users-api"
import { UsersForm } from "./users-form"

/** The Users list's URL state; users load in full and filter in the browser. */
export const userTableSearch = createTableSearch({
  fields: [
    { value: "name", label: "Name" },
    { value: "email", label: "Email" },
    { value: "role", label: "Role" },
    { value: "createdAt", label: "Joined", kind: "date" },
  ],
})

/** A role filter matches a role's name or key. */
export function readUserField(user: User, field: string) {
  if (field === "role")
    return (user.roles ?? []).flatMap((role) => [role.name, role.key])
  return user[field as "name" | "email" | "createdAt"]
}

const columnHelper = createColumnHelper<typeof dataTableFeatures, User>()

function UserRowActions({ user }: { user: User }) {
  const [editOpen, setEditOpen] = React.useState(false)
  const [removeOpen, setRemoveOpen] = React.useState(false)
  const currentUserId = useCurrentUserId()
  const canManageMembers = useTenantMemberManager()

  return (
    <>
      {canManageMembers ? (
        <Can I="update" a="User">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  className="flex size-8 text-muted-foreground data-open:bg-muted"
                  size="icon"
                />
              }
            >
              <EllipsisVerticalIcon />
              <span className="sr-only">Open Menu</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => {
                    setTimeout(() => setEditOpen(true), 0)
                  }}
                >
                  <SquarePenIcon />
                  Edit
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </Can>
      ) : null}
      <UsersForm user={user} open={editOpen} onOpenChange={setEditOpen} />
      {import.meta.env.VITE_MULTI_TENANCY === "true" &&
      canManageMembers &&
      user.id !== currentUserId ? (
        <Can I="delete" a="User">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove ${user.name}`}
            onClick={() => setRemoveOpen(true)}
          >
            <Trash2Icon />
          </Button>
        </Can>
      ) : null}
      <MemberRemoveDialog
        user={user}
        open={removeOpen}
        onOpenChange={setRemoveOpen}
      />
    </>
  )
}

export function createUsersTableColumns() {
  return columnHelper.columns([
    columnHelper.accessor("name", {
      header: "Name",
      cell: ({ row }) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar size="sm">
            {row.original.image ? (
              <AvatarImage src={row.original.image} alt={row.original.name} />
            ) : null}
            <AvatarFallback>{initials(row.original.name)}</AvatarFallback>
          </Avatar>
          <span className="truncate font-medium">{row.original.name}</span>
        </span>
      ),
      enableHiding: false,
    }),
    columnHelper.accessor("email", {
      header: "Email",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.email}</span>
      ),
    }),
    columnHelper.accessor(
      (row) => row.roles?.map((role) => role.name).join(", ") ?? "",
      {
        id: "role",
        header: "Role",
        cell: ({ row }) => {
          const roles = row.original.roles ?? []

          if (roles.length === 0) {
            return <span className="text-muted-foreground">—</span>
          }

          return (
            <div className="flex flex-wrap gap-1">
              {roles.map((role) => (
                <Badge key={role.id} variant="outline">
                  {role.name}
                </Badge>
              ))}
            </div>
          )
        },
      }
    ),
    columnHelper.accessor("createdAt", {
      header: "Joined",
      cell: ({ row }) => {
        if (!row.original.createdAt) {
          return <span className="text-muted-foreground">—</span>
        }

        return (
          <span className="text-muted-foreground">
            {formatRecordDate(row.original.createdAt)}
          </span>
        )
      },
    }),
    columnHelper.display({
      id: "actions",
      cell: ({ row }) => <UserRowActions user={row.original} />,
    }),
  ])
}
