import { cn } from "@/lib/utils"

export function scoreTone(score: number) {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 40) return "text-amber-600 dark:text-amber-400"
  return "text-muted-foreground"
}

/**
 * The match score as a ring. A ring reads at a glance in a list of postings,
 * where a bar would compete with the text for attention.
 */
export function ScoreDial({
  score,
  size = 46,
  label,
}: {
  score: number
  size?: number
  label?: string
}) {
  const clamped = Math.max(0, Math.min(100, score))

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${score}% match`}
    >
      <svg viewBox="0 0 48 48" aria-hidden className="size-full -rotate-90">
        <circle
          cx="24"
          cy="24"
          r="20"
          fill="none"
          strokeWidth="3.5"
          className="stroke-muted"
        />
        <circle
          cx="24"
          cy="24"
          r="20"
          fill="none"
          strokeWidth="3.5"
          stroke="currentColor"
          pathLength={100}
          strokeLinecap="round"
          strokeDasharray={`${clamped} 100`}
          className={cn("transition-all duration-500", scoreTone(score))}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center">
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            scoreTone(score),
            size >= 64 && "text-base"
          )}
        >
          {score}
        </span>
      </span>
    </div>
  )
}
