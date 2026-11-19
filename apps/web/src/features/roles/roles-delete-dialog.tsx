import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import {
  ConfirmDeleteDialog,
  RecordName,
} from "@/components/confirm-delete-dialog"
import { permissionsQueryOptions } from "@/features/permissions/permissions-api"
import { rolesQueryOptions, usersQueryOptions } from "@/features/users"
import type { Role } from "./roles-api"
import { deleteRole, workspaceRolesQueryOptions } from "./roles-api"

export function RolesDeleteDialog({
  role,
  open,
  onOpenChange,
}: {
  role: Role
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const router = useRouter()
  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete Role"
      description={
        <>
          This will delete <RecordName>{role.name}</RecordName> from workspace
          roles.
        </>
      }
      success="Role deleted"
      successDescription={role.name}
      failure="Unable to delete role"
      onConfirm={async () => {
        await deleteRole(role.id)
        await Promise.all([
          queryClient.invalidateQueries(workspaceRolesQueryOptions),
          queryClient.invalidateQueries(permissionsQueryOptions),
          queryClient.invalidateQueries(rolesQueryOptions),
          queryClient.invalidateQueries(usersQueryOptions),
          router.invalidate(),
        ])
      }}
    />
  )
}
