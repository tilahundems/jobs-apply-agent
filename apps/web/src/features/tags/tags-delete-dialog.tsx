import { useQueryClient } from "@tanstack/react-query"
import {
  ConfirmDeleteDialog,
  RecordName,
} from "@/components/confirm-delete-dialog"
import type { Tag } from "./tags-api"
import { deleteTag, tagsQueryOptions } from "./tags-api"

export function TagsDeleteDialog({
  tag,
  open,
  onOpenChange,
}: {
  tag: Tag
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete Tag"
      description={
        <>
          This will delete <RecordName>{tag.label}</RecordName> from your tags.
        </>
      }
      success="Tag deleted"
      successDescription={tag.label}
      failure="Unable to delete tag"
      onConfirm={async () => {
        await deleteTag(tag.id)
        await Promise.all([
          queryClient.invalidateQueries(tagsQueryOptions),
          queryClient.invalidateQueries({ queryKey: ["projects"] }),
        ])
      }}
    />
  )
}
