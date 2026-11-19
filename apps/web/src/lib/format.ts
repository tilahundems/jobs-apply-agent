export function formatRecordDate(value: string | null) {
  if (!value) return "Not set"
  // Date-only values represent local calendar days, not UTC timestamps.
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value
  )
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/** "2 days ago" style stamps, for things the agent did on its own schedule. */
export function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "never"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "never"

  const diff = date.getTime() - Date.now()
  const distance = Math.abs(diff)
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000_000],
    ["month", 2_592_000_000],
    ["week", 604_800_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ]
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
  for (const [unit, size] of units) {
    if (distance >= size) {
      return formatter.format(Math.round(diff / size), unit)
    }
  }
  return "just now"
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (
    (
      (parts[0]?.[0] ?? "") +
      (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")
    ).toUpperCase() || "U"
  )
}
