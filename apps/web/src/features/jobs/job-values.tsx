import { JOB_STATUS_LABELS } from "@et/contracts"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { JobStatus } from "./jobs-api"

const STATUS_CLASS: Record<JobStatus, string> = {
  new: "border-sky-600/40 text-sky-700 dark:text-sky-400",
  prepared: "border-amber-500/40 text-amber-700 dark:text-amber-400",
  applied: "border-emerald-600/40 text-emerald-700 dark:text-emerald-400",
  dismissed: "text-muted-foreground",
  blocked: "border-red-600/40 text-red-700 dark:text-red-400",
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <Badge variant="outline" className={STATUS_CLASS[status]}>
      {JOB_STATUS_LABELS[status]}
    </Badge>
  )
}

/** A posting's match score, coloured by how far it clears the threshold. */
export function JobScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 85
      ? "text-emerald-700 dark:text-emerald-400"
      : score >= 70
        ? "text-amber-700 dark:text-amber-400"
        : "text-muted-foreground"

  return (
    <Badge variant="outline" className={cn("tabular-nums", tone)}>
      {score}%
    </Badge>
  )
}
