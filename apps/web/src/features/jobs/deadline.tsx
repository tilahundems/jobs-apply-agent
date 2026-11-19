import { CalendarClockIcon, CalendarXIcon } from "lucide-react"
import { formatRecordDate } from "@/lib/format"
import { cn } from "@/lib/utils"

export type DeadlineState = "none" | "open" | "today" | "passed"

/** A posting closes at the end of the day it names, so the whole day is open. */
export function deadlineState(value: string | null | undefined): DeadlineState {
  if (!value) return "none"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "none"
  const now = new Date()
  if (date.getTime() < now.getTime()) return "passed"
  return date.toDateString() === now.toDateString() ? "today" : "open"
}

/**
 * The closing date is the one fact a posting can carry that makes every other
 * column irrelevant, so it is stated plainly and turns destructive when gone.
 */
export function DeadlineBadge({
  value,
  className,
}: {
  value: string | null | undefined
  className?: string
}) {
  const state = deadlineState(value)
  if (state === "none") return null

  const passed = state === "passed"
  const Icon = passed ? CalendarXIcon : CalendarClockIcon

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap",
        passed
          ? "font-medium text-destructive"
          : state === "today"
            ? "font-medium text-amber-600 dark:text-amber-400"
            : "text-muted-foreground",
        className
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      {passed
        ? "Deadline passed"
        : state === "today"
          ? "Closes today"
          : `Closes ${formatRecordDate(value ?? null)}`}
    </span>
  )
}
