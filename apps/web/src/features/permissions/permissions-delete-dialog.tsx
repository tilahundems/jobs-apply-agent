import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { workspaceRolesQueryOptions } from "@/features/roles/roles-api"
import type { Permission } from "./permissions-api"
import { deletePermission, permissionsQueryOptions } from "./permissions-api"

export function PermissionsDeleteDialog({
  permission,
  open,
  onOpenChange,
}: {
  permission: Permission
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { roleCount } = permission
  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete permission?"
      description={
        roleCount
          ? `This permission is used by ${roleCount} ${roleCount === 1 ? "role" : "roles"}. Remove it from those roles before deleting it.`
          : `Delete ${permission.action} on ${permission.subject}? You can create it again later.`
      }
      // A permission still granted to a role cannot be deleted.
      disabled={roleCount > 0}
      confirmLabel="Delete permission"
      success="Permission deleted"
      failure="Unable to delete permission"
      onConfirm={async () => {
        await deletePermission(permission.id)
        await Promise.all([
          queryClient.invalidateQueries(permissionsQueryOptions),
          queryClient.invalidateQueries(workspaceRolesQueryOptions),
          router.invalidate(),
        ])
      }}
    />
  )
}
