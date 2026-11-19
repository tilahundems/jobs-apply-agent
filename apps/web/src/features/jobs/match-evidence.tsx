import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/** Century-style banding: green is worth applying to today, amber is borderline. */
export function scoreTone(score: number) {
  if (score >= 70) {
    return {
      text: "text-emerald-700 dark:text-emerald-400",
      bar: "bg-emerald-500",
    }
  }
  if (score >= 40) {
    return {
      text: "text-amber-700 dark:text-amber-400",
      bar: "bg-amber-500",
    }
  }
  return { text: "text-muted-foreground", bar: "bg-muted-foreground/60" }
}

/** The score, as a bar. Numbers alone do not say how strong a match feels. */
export function ScoreMeter({
  score,
  size = "default",
  className,
}: {
  score: number
  size?: "default" | "lg"
  className?: string
}) {
  const tone = scoreTone(score)
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "overflow-hidden rounded-full bg-muted",
          size === "lg" ? "h-2 w-28" : "h-1.5 w-14"
        )}
      >
        <div
          className={cn("h-full rounded-full", tone.bar)}
          style={{ width: `${Math.min(100, Math.max(3, score))}%` }}
        />
      </div>
      <span
        className={cn(
          "font-medium tabular-nums",
          size === "lg" ? "text-lg" : "text-sm",
          tone.text
        )}
      >
        {score}%
      </span>
    </div>
  )
}

/** Reason strings are written for the record; chips need them shorter. */
function labelFor(reason: string) {
  const title = reason.match(/^title matches "(.+)"$/)
  if (title) return `title: ${title[1]}`
  const partial = reason.match(/^title partially matches: (.+)$/)
  if (partial) return `title words: ${partial[1]}`
  const location = reason.match(/^location matches "(.+)"$/)
  if (location) return `location: ${location[1]}`
  if (reason === "remote-friendly") return "remote"
  const seniority = reason.match(/^seniority (fits|close) \((.+)\)$/)
  if (seniority) return `level: ${seniority[2]}`
  return reason
}

/**
 * Why a posting scored what it did: the skills it mentions, then the other
 * signals. Skills are skipped in the reason list because they are shown
 * separately, one chip each.
 */
export function EvidenceChips({
  skills,
  reasons,
  limit = 4,
  className,
}: {
  skills: string[]
  reasons: string[]
  limit?: number
  className?: string
}) {
  const items = [
    ...skills.map((skill) => ({ key: `skill-${skill}`, label: skill })),
    ...reasons
      .filter((reason) => !/^\d+ of your skills mentioned/.test(reason))
      .map((reason) => ({ key: `reason-${reason}`, label: labelFor(reason) })),
  ]
  if (items.length === 0) return null

  const shown = items.slice(0, limit)
  const hidden = items.length - shown.length

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {shown.map((item) => (
        <Badge
          key={item.key}
          variant="secondary"
          className="max-w-56 truncate text-[11px] font-normal"
        >
          {item.label}
        </Badge>
      ))}
      {hidden > 0 ? (
        <span className="text-[11px] text-muted-foreground">+{hidden}</span>
      ) : null}
    </div>
  )
}
