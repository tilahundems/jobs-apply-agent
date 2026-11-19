import { JOB_STATUS_LABELS } from "@et/contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  DownloadIcon,
  ExternalLinkIcon,
  MoreHorizontalIcon,
  SparklesIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DeadlineBadge } from "@/features/jobs/deadline"
import {
  type JobStatus,
  jobCvUrl,
  prepareJob,
  setJobStatus,
} from "@/features/jobs/jobs-api"
import { EvidenceChips } from "@/features/jobs/match-evidence"
import { formatRelativeTime } from "@/lib/format"
import { ScoreDial } from "./score-dial"

/** The fields a row needs; both `Job` and the summary's lighter matches qualify. */
export type MatchItem = {
  id: string
  title: string | null
  company: string | null
  location: string | null
  channel: string
  url: string | null
  score: number
  status: JobStatus
  reasons: string[]
  gaps: string[]
  matchedSkills: string[]
  deadlineAt?: string | null
  createdAt: string
  tailoredCv?: string | null
}

const STATUS_DOT: Record<JobStatus, string> = {
  new: "bg-sky-500",
  prepared: "bg-amber-500",
  applied: "bg-emerald-500",
  dismissed: "bg-muted-foreground/50",
  blocked: "bg-destructive",
}

function useMatchActions(job: MatchItem) {
  const queryClient = useQueryClient()

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["jobs"] })
  }

  const prepare = useMutation({
    mutationFn: () => prepareJob(job.id),
    onSuccess: () => {
      refresh()
      toast.success("CV and cover letter written")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const setStatus = useMutation({
    mutationFn: (status: Exclude<JobStatus, "blocked">) =>
      setJobStatus(job.id, status),
    onSuccess: (updated) => {
      refresh()
      toast.success(`Marked ${JOB_STATUS_LABELS[updated.status].toLowerCase()}`)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return { prepare, setStatus }
}

/**
 * One posting as a line of text rather than a table row: score, what it is,
 * why it matched, and only the action that makes sense for its status.
 */
export function MatchRow({ job }: { job: MatchItem }) {
  const { prepare, setStatus } = useMatchActions(job)
  const meta = [job.company, `@${job.channel}`, job.location]
    .filter(Boolean)
    .join(" · ")

  return (
    <article className="flex gap-4 py-5">
      <ScoreDial score={job.score} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              to="/jobs/$jobId"
              params={{ jobId: job.id }}
              className="line-clamp-2 text-[15px] font-medium leading-snug underline-offset-4 hover:underline"
            >
              {job.title ?? "Untitled post"}
            </Link>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={`size-1.5 rounded-full ${STATUS_DOT[job.status]}`}
                />
                {JOB_STATUS_LABELS[job.status]}
              </span>
              <span aria-hidden>·</span>
              <span className="truncate">{meta}</span>
              <span aria-hidden>·</span>
              <span className="whitespace-nowrap">
                found {formatRelativeTime(job.createdAt)}
              </span>
              <DeadlineBadge value={job.deadlineAt} />
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {job.status === "new" ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => prepare.mutate()}
                disabled={prepare.isPending}
              >
                <SparklesIcon />
                {prepare.isPending ? "Writing…" : "Prepare"}
              </Button>
            ) : null}
            {job.tailoredCv ? (
              <Button
                size="sm"
                variant="ghost"
                nativeButton={false}
                render={<a href={jobCvUrl(job.id)} download />}
              >
                <DownloadIcon />
                CV
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="More actions"
                  />
                }
              >
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuItem
                  render={<Link to="/jobs/$jobId" params={{ jobId: job.id }} />}
                >
                  <ExternalLinkIcon />
                  Open posting
                </DropdownMenuItem>
                {job.url ? (
                  <DropdownMenuItem
                    render={
                      <a href={job.url} target="_blank" rel="noreferrer" />
                    }
                  >
                    <ExternalLinkIcon />
                    Source on Telegram
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={job.status === "applied"}
                  onClick={() => setStatus.mutate("applied")}
                >
                  Mark applied
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={job.status === "dismissed"}
                  onClick={() => setStatus.mutate("dismissed")}
                >
                  Dismiss
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1">
          <EvidenceChips
            skills={job.matchedSkills}
            reasons={job.reasons}
            limit={4}
          />
        </div>
        {job.gaps.length > 0 ? (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Watch out: {job.gaps.slice(0, 2).join("; ")}
          </p>
        ) : null}
      </div>
    </article>
  )
}
