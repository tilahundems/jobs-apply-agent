import {
  EllipsisVerticalIcon,
  EyeIcon,
  SquarePenIcon,
  Trash2Icon,
} from "lucide-react"
import type { ReactElement, ReactNode } from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Subject } from "@/features/authz"
import { subject as an, useAppAbility } from "@/features/authz"

type Dialog = (
  open: boolean,
  onOpenChange: (open: boolean) => void
) => ReactNode

/**
 * The row menu for a list table: View (a link element), Edit and Delete.
 * Edit and Delete show only when the user may update or delete `subject`;
 * pass `record` to check rule conditions against that row.
 */
export function RowActions({
  subject,
  record,
  view,
  edit,
  remove,
}: {
  subject: Exclude<Subject, "all">
  record?: Record<string, unknown>
  view?: ReactElement
  edit?: Dialog
  remove?: Dialog
}) {
  const ability = useAppAbility()
  const [editOpen, setEditOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const target = record ? an(subject, record) : subject
  const canEdit = !!edit && ability.can("update", target)
  const canRemove = !!remove && ability.can("delete", target)

  if (!view && !canEdit && !canRemove) return null

  return (
    <>
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
          {view ? (
            <DropdownMenuItem render={view}>
              <EyeIcon />
              View
            </DropdownMenuItem>
          ) : null}
          {canEdit ? (
            // Open after the menu closes so focus moves into the dialog.
            <DropdownMenuItem
              onClick={() => setTimeout(() => setEditOpen(true))}
            >
              <SquarePenIcon />
              Edit
            </DropdownMenuItem>
          ) : null}
          {canRemove ? (
            <>
              {view || canEdit ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setTimeout(() => setRemoveOpen(true))}
              >
                <Trash2Icon />
                Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {canEdit ? edit(editOpen, setEditOpen) : null}
      {canRemove ? remove(removeOpen, setRemoveOpen) : null}
    </>
  )
}
