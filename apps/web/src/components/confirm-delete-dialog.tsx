import { useMutation } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"

/** Bold record name inside a confirmation description. */
export function RecordName({ children }: { children: ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>
}

/**
 * Confirms a destructive action. `onConfirm` runs the request and refreshes
 * caches; the dialog stays open and shows the error if it throws.
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  success,
  successDescription,
  failure,
  confirmLabel = "Delete",
  pendingLabel = "Deleting...",
  disabled = false,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  onConfirm: () => Promise<unknown>
  success: string
  successDescription?: string
  failure: string
  confirmLabel?: string
  pendingLabel?: string
  disabled?: boolean
  onDone?: () => void
}) {
  const confirm = useMutation({ mutationFn: onConfirm })

  async function handleConfirm() {
    try {
      await confirm.mutateAsync()
      toast.success(success, { description: successDescription })
      onOpenChange(false)
      onDone?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : failure)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!confirm.isPending) onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="p-6 sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="-mx-6 -mb-6">
          <Field orientation="horizontal" className="justify-end">
            <DialogClose
              render={<Button variant="outline" disabled={confirm.isPending} />}
            >
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => void handleConfirm()}
              disabled={confirm.isPending || disabled}
            >
              {confirm.isPending ? pendingLabel : confirmLabel}
            </Button>
          </Field>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
