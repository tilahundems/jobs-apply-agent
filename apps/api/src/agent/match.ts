/**
 * Scoring a posting against the profile. Rule-based and local: free, instant,
 * explainable, and tunable from the profile's preferences.
 */
import type { ProfilePreferences } from "@et/db"
import type { ParsedJob } from "./parse.js"

const SENIORITY_ORDER: Record<string, number> = {
  intern: 0,
  internship: 0,
  junior: 1,
  entry: 1,
  mid: 2,
  "mid-level": 2,
  middle: 2,
  senior: 3,
  lead: 4,
  principal: 4,
  staff: 4,
}

const SENIORITY_PATTERNS: Array<[string, RegExp]> = [
  ["intern", /\b(intern|internship|trainee)\b/],
  ["junior", /\b(junior|jr\.?|entry[- ]level|graduate)\b/],
  ["mid", /\b(mid[- ]level|intermediate)\b/],
  ["senior", /\b(senior|sr\.?)\b/],
  ["lead", /\b(lead|team lead|tech lead)\b/],
  ["principal", /\b(principal|staff|architect)\b/],
]

/**
 * Role nouns that say nothing about the domain. Sharing "engineer" must not
 * make a construction, textile or sales post look like a backend role, so they
 * earn no partial title credit on their own.
 */
const GENERIC_TITLE_WORDS = new Set([
  "engineer",
  "developer",
  "manager",
  "officer",
  "specialist",
  "analyst",
  "intern",
  "trainee",
  "support",
  "administrator",
  "technician",
  "consultant",
  "coordinator",
  "assistant",
  "supervisor",
  "head",
  "director",
  "staff",
  "lead",
  "senior",
  "junior",
  "entry",
  "with",
  "from",
])

const TECH_WORDS =
  /\b(java|javascript|typescript|go|golang|rust|c\+\+|c#|php|ruby|kotlin|swift|react|vue|angular|node|django|flask|fastapi|spring|laravel|rails|kubernetes|aws|azure|gcp|terraform|mongodb|mysql|postgres|redis|graphql)\b/g

export type MatchResult = {
  score: number
  blocked: boolean
  reasons: string[]
  gaps: string[]
  matchedSkills: string[]
  missingSkills: string[]
}

export type MatchProfile = {
  skills: string[]
  preferences: ProfilePreferences
}

const norm = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim()

const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

export function detectSeniority(text: string): string | null {
  const body = norm(text)
  let best: string | null = null
  let bestRank = -1
  for (const [name, pattern] of SENIORITY_PATTERNS) {
    if (!pattern.test(body)) continue
    const rank = SENIORITY_ORDER[name] ?? 0
    if (rank > bestRank) {
      best = name
      bestRank = rank
    }
  }
  return best
}

export function scoreJob(
  jobText: string,
  job: ParsedJob,
  profile: MatchProfile
): MatchResult {
  const prefs = profile.preferences
  const body = norm(jobText)
  const reasons: string[] = []
  const gaps: string[] = []

  for (const keyword of prefs.excludeKeywords) {
    if (body.includes(norm(keyword))) {
      return {
        score: 0,
        blocked: true,
        reasons: [`excluded: contains "${keyword}"`],
        gaps: [],
        matchedSkills: [],
        missingSkills: [],
      }
    }
  }

  let score = 0

  // Titles — up to 40 points.
  const haystack = `${norm(job.title ?? "")} ${body}`
  const titleHit = prefs.titles.find((title) => haystack.includes(norm(title)))
  if (titleHit) {
    score += 40
    reasons.push(`title matches "${titleHit}"`)
  } else if (job.title) {
    const words = (value: string) =>
      new Set(
        norm(value)
          .split(/[^a-z0-9+#.]+/)
          .filter((word) => word.length > 3)
      )
    const jobWords = words(job.title)
    const wanted = new Set(prefs.titles.flatMap((title) => [...words(title)]))
    const shared = [...jobWords].filter(
      (word) => wanted.has(word) && !GENERIC_TITLE_WORDS.has(word)
    )
    if (shared.length > 0) {
      score += 20
      reasons.push(`title partially matches: ${shared.join(", ")}`)
    } else {
      gaps.push("job title is outside your target roles")
    }
  }

  // Skills — up to 30 points.
  const matched = profile.skills.filter((skill) =>
    new RegExp(`\\b${escapeRe(norm(skill))}\\b`).test(body)
  )
  if (matched.length > 0) {
    score += Math.min(30, matched.length * 3)
    reasons.push(
      `${matched.length} of your skills mentioned: ${matched.slice(0, 8).join(", ")}`
    )
  } else {
    gaps.push("none of your listed skills appear in the post")
  }

  const have = new Set(profile.skills.map(norm))
  const unknown = [
    ...new Set(
      (body.match(TECH_WORDS) ?? []).filter((word) => !have.has(word))
    ),
  ]
  if (unknown.length > 0) {
    gaps.push(`post also asks for: ${unknown.slice(0, 6).join(", ")}`)
  }

  // Location and remote — up to 15 points.
  const locations = prefs.locations.map(norm)
  const isRemote = /\b(remote|work from home|wfh|anywhere)\b/.test(body)
  const locationHit = locations.find((location) => body.includes(location))
  if (isRemote && prefs.remoteOk) {
    score += 15
    reasons.push("remote-friendly")
  } else if (locationHit) {
    score += 15
    reasons.push(`location matches "${locationHit}"`)
  } else if (locations.length > 0) {
    score += 5
    gaps.push("location not stated or not in your list")
  }

  // Seniority — up to 15 points.
  const wanted = prefs.seniority
  const post = detectSeniority(`${job.title ?? ""} ${jobText}`)
  if (wanted && post) {
    const delta = Math.abs(
      (SENIORITY_ORDER[post] ?? 2) - (SENIORITY_ORDER[wanted] ?? 2)
    )
    if (delta === 0) {
      score += 15
      reasons.push(`seniority fits (${post})`)
    } else if (delta === 1) {
      score += 8
      reasons.push(`seniority close (${post} vs ${wanted})`)
    } else {
      gaps.push(`seniority mismatch (${post} vs ${wanted})`)
    }
  } else {
    score += 10
  }

  // A posting can collect location and seniority points while matching neither
  // a target title nor one of your skills. Cap it so geography and an unstated
  // level can never clear a normal threshold on their own.
  if (!titleHit && matched.length === 0 && score > 30) {
    score = 30
    gaps.push("no title or skill overlap: capped at 30")
  }

  for (const keyword of prefs.avoidKeywords) {
    if (body.includes(norm(keyword))) {
      score -= 10
      gaps.push(`has "${keyword}" which you wanted to avoid`)
    }
  }

  if (!job.isProbablyJob) {
    score -= 25
    gaps.push("does not look like a job post")
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    blocked: false,
    reasons,
    gaps,
    matchedSkills: matched,
    missingSkills: profile.skills.filter((skill) => !matched.includes(skill)),
  }
}
