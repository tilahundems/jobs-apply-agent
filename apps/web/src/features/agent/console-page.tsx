import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  ArrowRightIcon,
  EyeIcon,
  FileTextIcon,
  FlameIcon,
  InboxIcon,
  type LucideIcon,
  RadioTowerIcon,
  SendIcon,
  SparklesIcon,
} from "lucide-react"
import { jobSummaryQueryOptions } from "@/features/jobs/jobs-api"
import { formatRelativeTime } from "@/lib/format"
import { channelLanes } from "./channels"
import { MatchRow } from "./match-row"
import { ScoreDial } from "./score-dial"

/**
 * The console is the agent's own report: what it watched, what it kept, and the
 * few postings worth reading right now. Everything else lives in Matches.
 */
export function ConsolePage() {
  const summaryQuery = useQuery(jobSummaryQueryOptions)

  if (summaryQuery.isError) {
    return (
      <div className="py-16">
        <h1 className="text-xl font-semibold">The console is blocked</h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          It reads postings, and your account cannot read them right now:{" "}
          {summaryQuery.error.message}
        </p>
      </div>
    )
  }

  if (summaryQuery.isPending) {
    return (
      <div className="animate-pulse py-10" aria-hidden>
        <div className="h-4 w-28 rounded bg-muted" />
        <div className="mt-5 h-9 w-2/3 rounded bg-muted" />
        <div className="mt-8 h-24 rounded-xl bg-muted/60" />
      </div>
    )
  }

  const summary = summaryQuery.data
  const lanes = channelLanes(summary)
  const watched = lanes.length
  const silent = lanes.filter((lane) => lane.total === 0).length

  return (
    <div className="pt-8">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
        Agent console
      </p>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-6 border-b border-border/60 pb-8">
        <div className="min-w-0">
          <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-[2.15rem] sm:leading-[1.15]">
            {summary.total === 0
              ? "Nothing kept yet."
              : `${summary.total} ${summary.total === 1 ? "posting" : "postings"} kept from ${watched} channels.`}
          </h1>
          <p className="mt-2.5 text-sm text-muted-foreground">
            Last kept {formatRelativeTime(summary.lastFoundAt)} · keeps anything
            scoring {summary.minMatchScore}% or better · best so far{" "}
            {summary.bestScore}%
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ScoreDial
            score={summary.bestScore}
            size={64}
            label={`Best match ${summary.bestScore}%`}
          />
          <div className="text-xs leading-tight text-muted-foreground">
            <span className="block font-medium text-foreground">
              Best match
            </span>
            {summary.strong} at 70% or better
          </div>
        </div>
      </div>

      <StageRail
        watched={watched}
        kept={summary.total}
        strong={summary.strong}
        written={summary.byStatus.prepared}
        applied={summary.byStatus.applied}
        threshold={summary.minMatchScore}
      />

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <section className="min-w-0">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <SparklesIcon className="size-4 text-muted-foreground" />
              Newest from the channels
            </h2>
            <Link
              to="/jobs"
              className="group inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              All {summary.total} matches
              <ArrowRightIcon className="size-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {summary.top.length === 0 ? (
            <p className="mt-4 max-w-prose border-t border-border/60 pt-5 text-sm text-muted-foreground">
              The agent has not kept a posting that clears your threshold. Run a
              scan, or loosen the threshold in your profile if the channels are
              posting work you should have seen.
            </p>
          ) : (
            <div className="mt-1 divide-y divide-border/60 border-t border-border/60">
              {summary.top.map((job) => (
                <MatchRow key={job.id} job={job} />
              ))}
            </div>
          )}
        </section>

        <aside className="min-w-0 lg:pt-0.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <RadioTowerIcon className="size-4 text-muted-foreground" />
            Channels
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {silent === 0
              ? "Every channel has produced at least one keeper."
              : `${silent} of ${watched} produced nothing kept.`}
          </p>
          <ul className="mt-3 space-y-2.5">
            {lanes.slice(0, 12).map((lane) => (
              <li key={lane.handle} className="text-xs">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-foreground">
                    @{lane.handle}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {lane.total > 0 ? `${lane.total} kept` : "silent"}
                  </span>
                </div>
                {lane.total > 0 ? (
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground/25"
                      style={{ width: `${Math.max(lane.bestScore, 4)}%` }}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {lanes.length > 12 ? (
            <p className="mt-3 text-[11px] text-muted-foreground">
              +{lanes.length - 12} more in your profile
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

/** The funnel the agent works through, in order, with the threshold on the door. */
function StageRail({
  watched,
  kept,
  strong,
  written,
  applied,
  threshold,
}: {
  watched: number
  kept: number
  strong: number
  written: number
  applied: number
  threshold: number
}) {
  const stages: Array<{
    label: string
    value: number
    hint: string
    icon: LucideIcon
  }> = [
    {
      label: "Watched",
      value: watched,
      hint: "channels in your profile",
      icon: EyeIcon,
    },
    {
      label: "Kept",
      value: kept,
      hint: `${threshold}% or better`,
      icon: InboxIcon,
    },
    { label: "Strong", value: strong, hint: "70% or better", icon: FlameIcon },
    {
      label: "Written",
      value: written,
      hint: "CV and cover letter",
      icon: FileTextIcon,
    },
    { label: "Applied", value: applied, hint: "marked by you", icon: SendIcon },
  ]

  return (
    <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60 sm:grid-cols-5">
      {stages.map((stage) => (
        <div key={stage.label} className="bg-background px-4 py-3.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-2xl font-semibold tabular-nums">{stage.value}</p>
            <stage.icon className="mt-1 size-4 shrink-0 text-muted-foreground" />
          </div>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-foreground/80">
            {stage.label}
          </p>
          <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
            {stage.hint}
          </p>
        </div>
      ))}
    </div>
  )
}
