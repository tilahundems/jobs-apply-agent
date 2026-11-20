/** Pulling structure out of messy channel posts. Heuristic and forgiving. */

export type ParsedJob = {
  title: string | null
  company: string | null
  location: string | null
  /** End of the day the posting says it closes, when it says anything. */
  deadlineAt: Date | null
  links: string[]
  emails: string[]
  isProbablyJob: boolean
}

const URL_RE = /https?:\/\/[^\s<>"')]+/g
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/g
const TITLE_LABEL_RE =
  /^[\s\-•*]*(?:job\s*title|position|role|vacancy|title)\s*[:\-–]\s*(.+)$/gim
const COMPANY_LABEL_RE =
  /^[\s\-•*]*(?:company|organization|organisation|employer)\s*[:\-–]\s*(.+)$/gim
const LOCATION_LABEL_RE =
  /^[\s\-•*]*(?:location|based\s+in|city|place)\s*[:\-–]\s*(.+)$/gim
const HIRING_RE =
  /(?:hiring|looking\s+for|vacancy\s+for|seeking)\s*(?:a|an)?\s*[:\-–]?\s*(.+)/i
const AT_COMPANY_RE =
  /\s+(?:at|@|in)\s+([A-Z][\w&.-]*(?:\s+[A-Z][\w&.-]*){0,3})\s*$/
const DEADLINE_LABEL_RE =
  /(?:deadline|apply\s+(?:before|by|until)|applications?\s+(?:close|closes|must\s+be\s+sent)|closing\s+date|last\s+date(?:\s+(?:to\s+apply|of\s+application))?|due\s+date|submission\s+deadline)\s*(?:is|on|:|-|–)?\s*([^\n]{3,60})/gi

const MONTH_INDEX: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

const DAY_MS = 86_400_000

/** A deadline covers its whole day, so it closes at the end of it. */
function endOfDay(year: number, month: number, day: number): Date | null {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null
  }
  const date = new Date(year, month - 1, day, 23, 59, 59, 999)
  const valid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  const plausible = year >= 2000 && year <= new Date().getFullYear() + 3
  return valid && plausible ? date : null
}

function monthOf(value: string) {
  return MONTH_INDEX[value.toLowerCase().slice(0, 3)]
}

/** Reads a date out of the words around a deadline label. */
function dateFromPhrase(value: string): Date | null {
  const text = value.replace(/[.,;]+$/, "").trim()

  const relative = /\bin\s+(\d{1,2})\s+(day|week|month)s?\b/i.exec(text)
  if (relative?.[1] && relative[2]) {
    const amount = Number(relative[1])
    const unit = relative[2].toLowerCase()
    const unitMs =
      unit === "day" ? DAY_MS : unit === "week" ? DAY_MS * 7 : DAY_MS * 30
    return new Date(Date.now() + amount * unitMs)
  }

  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text)
  if (iso?.[1] && iso[2] && iso[3]) {
    return endOfDay(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  }

  // Day-first is the convention in the channels these postings come from.
  const numeric = /\b(\d{1,2})[./](\d{1,2})[./](\d{2,4})\b/.exec(text)
  if (numeric?.[1] && numeric[2] && numeric[3]) {
    let day = Number(numeric[1])
    let month = Number(numeric[2])
    const year =
      Number(numeric[3]) < 100 ? 2000 + Number(numeric[3]) : Number(numeric[3])
    // `25/11/2026` is day-first; only a month above 12 proves the other order.
    if (month > 12 && day <= 12) {
      const swap = day
      day = month
      month = swap
    }
    return endOfDay(year, month, day)
  }

  const dayMonth =
    /\b(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]{3,9})\.?,?[\s-]+(\d{4})\b/i.exec(
      text
    )
  if (dayMonth?.[1] && dayMonth[2] && dayMonth[3]) {
    const month = monthOf(dayMonth[2])
    if (month) return endOfDay(Number(dayMonth[3]), month, Number(dayMonth[1]))
  }

  const monthDay =
    /\b([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i.exec(text)
  if (monthDay?.[1] && monthDay[2] && monthDay[3]) {
    const month = monthOf(monthDay[1])
    if (month) return endOfDay(Number(monthDay[3]), month, Number(monthDay[2]))
  }

  return null
}

/** A posting that closed cannot be applied to, so the agent stops keeping it. */
export function isDeadlinePassed(
  deadline: Date | null,
  now: Date = new Date()
): boolean {
  return deadline !== null && deadline.getTime() < now.getTime()
}

/**
 * Finds the closing date a posting states, or null when it states none. Only
 * labelled dates count, so an event date elsewhere in the text is not mistaken
 * for the deadline.
 */
export function parseDeadline(text: string): Date | null {
  // A post can say "apply by email" before it states the closing date, so try
  // every labelled phrase rather than only the first one.
  DEADLINE_LABEL_RE.lastIndex = 0
  let labelled: RegExpExecArray | null = DEADLINE_LABEL_RE.exec(text)
  while (labelled) {
    if (labelled[1]) {
      const parsed = dateFromPhrase(labelled[1])
      if (parsed) return parsed
    }
    if (DEADLINE_LABEL_RE.lastIndex === labelled.index) {
      DEADLINE_LABEL_RE.lastIndex += 1
    }
    labelled = DEADLINE_LABEL_RE.exec(text)
  }

  const keyword = text.search(/deadline/i)
  if (keyword >= 0) {
    return dateFromPhrase(text.slice(keyword, keyword + 80))
  }

  return null
}

const ROLE_WORDS = [
  "engineer",
  "developer",
  "designer",
  "manager",
  "analyst",
  "intern",
  "specialist",
  "architect",
  "scientist",
  "officer",
]

const JOB_SIGNALS = [
  "experience",
  "requirement",
  "qualification",
  "responsibilit",
  "salary",
  "apply",
  "skill",
  "years",
  "full-time",
  "full time",
  "contract",
  "remote",
  "cv",
  "resume",
  "send",
]

export function stripEmoji(text: string) {
  return text.replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, "")
}

export function cleanLine(line: string) {
  return stripEmoji(line)
    .replace(/[#*_`]+/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s\t\-–•|:]+|[\s\t\-–•|:]+$/g, "")
}

function firstMatch(re: RegExp, text: string) {
  re.lastIndex = 0
  const match = re.exec(text)
  return match?.[1] ? cleanLine(match[1]).slice(0, 120) : null
}

export function parseJob(text: string): ParsedJob {
  const lines = text
    .split("\n")
    .map(cleanLine)
    .filter((line) => line.length > 0)

  let title = firstMatch(TITLE_LABEL_RE, text)

  if (!title) {
    for (const line of lines.slice(0, 6)) {
      if (line.length > 90) continue
      const hiring = HIRING_RE.exec(line)
      if (hiring?.[1]) {
        title = cleanLine(hiring[1]).slice(0, 120) || null
        break
      }
    }
  }

  if (!title) {
    for (const line of lines.slice(0, 4)) {
      const lowered = line.toLowerCase()
      if (
        line.length > 3 &&
        line.length <= 70 &&
        ROLE_WORDS.some((word) => lowered.includes(word))
      ) {
        title = line.slice(0, 120)
        break
      }
    }
  }

  let company = firstMatch(COMPANY_LABEL_RE, text)
  if (!company && title) {
    const atCompany = AT_COMPANY_RE.exec(title)
    if (atCompany?.[1]) {
      company = cleanLine(atCompany[1]).slice(0, 80)
      title = cleanLine(title.slice(0, atCompany.index)).slice(0, 120) || title
    }
  }

  const location = firstMatch(LOCATION_LABEL_RE, text)

  const links = [
    ...new Set(
      (text.match(URL_RE) ?? []).map((link) => link.replace(/[.,);]+$/, ""))
    ),
  ]
  const emails = [...new Set(text.match(EMAIL_RE) ?? [])]

  const body = lines.join(" ").toLowerCase()
  const isProbablyJob =
    JOB_SIGNALS.filter((signal) => body.includes(signal)).length >= 3

  return {
    title,
    company,
    location,
    deadlineAt: parseDeadline(text),
    links,
    emails,
    isProbablyJob,
  }
}
