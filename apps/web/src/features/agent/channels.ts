import type { JobSummary } from "@/features/jobs/jobs-api"

export type ChannelLane = {
  handle: string
  total: number
  bestScore: number
  lastFoundAt: string | null
}

/** Channels are saved as full links in the profile but reported as handles. */
export function handleOf(value: string) {
  return value
    .replace(/^https?:\/\/t\.me\//, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "")
}

/**
 * Every watched channel, including the ones that have never produced a kept
 * posting — silence is information about the source, not about the candidate.
 */
export function channelLanes(summary: JobSummary): ChannelLane[] {
  const reported = new Map<string, ChannelLane>(
    summary.channels.map((lane) => [
      lane.channel,
      {
        handle: lane.channel,
        total: lane.total,
        bestScore: lane.bestScore,
        lastFoundAt: lane.lastFoundAt,
      },
    ])
  )
  const handles = new Set([
    ...summary.watched.map(handleOf),
    ...summary.channels.map((lane) => lane.channel),
  ])

  return [...handles]
    .map(
      (handle) =>
        reported.get(handle) ?? {
          handle,
          total: 0,
          bestScore: 0,
          lastFoundAt: null,
        }
    )
    .sort(
      (left, right) =>
        right.total - left.total ||
        right.bestScore - left.bestScore ||
        left.handle.localeCompare(right.handle)
    )
}
