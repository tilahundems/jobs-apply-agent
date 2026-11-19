import { useState } from "react"

/**
 * Open state for a dialog that works controlled (`open` passed by a row
 * action) or uncontrolled (opened by its own trigger).
 */
export function useDialogOpen(
  open: boolean | undefined,
  onOpenChange?: (open: boolean) => void
) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  return {
    open: open ?? uncontrolledOpen,
    setOpen(next: boolean) {
      if (open === undefined) setUncontrolledOpen(next)
      onOpenChange?.(next)
    },
  }
}
