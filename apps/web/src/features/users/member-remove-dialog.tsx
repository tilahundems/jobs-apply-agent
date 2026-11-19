import { useQueryClient } from "@tanstack/react-query"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { removeMembership, type User, usersQueryOptions } from "./users-api"

export function MemberRemoveDialog({
  user,
  open,
  onOpenChange,
}: {
  user: User
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Remove member"
      description={`Remove ${user.name} (${user.email}) from this organization?`}
      confirmLabel="Remove member"
      pendingLabel="Removing..."
      success="Member removed"
      failure="Unable to remove member"
      onConfirm={async () => {
        await removeMembership(user.id)
        await queryClient.invalidateQueries(usersQueryOptions)
      }}
    />
  )
}
