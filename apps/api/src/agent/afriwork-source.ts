/**
 * Reading postings from Afriwork (afriworket.com).
 *
 * The job board is a Nuxt app over a Hasura-style GraphQL API. Its public feed
 * answers with `x-hasura-role: anonymous`, so no account, key or password is
 * needed to read vacancies — only to apply to them.
 *
 * Applying on Afriwork happens in their own web app / Telegram mini app, where
 * the applicant's saved CV and portfolio live. This module only reads; it never
 * sends an application.
 */

export type AfriworkJob = {
  id: string
  title: string | null
  description: string | null
  deadline: string | null
  jobType: string | null
  jobSite: string | null
  company: string | null
  location: string | null
  skills: string[]
  postedAt: Date | null
}

export type AfriworkFetch = {
  jobs: AfriworkJob[]
  warnings: string[]
}

const ENDPOINT = "https://api.afriworket.com/v1/graphql"
const PAGE_SIZE = 10

/** The feed query the site itself sends, kept in step with its field names. */
const QUERY = `query GetAllJobs($offset: Int!, $whereCondition: jobs_bool_exp!, $orderCondition: [jobs_order_by!]) {
  jobs(order_by: $orderCondition, offset: $offset, limit: 10, where: $whereCondition) {
    id
    title
    published_at
    refreshed_at
    latest_activity_at
    description
    job_type
    job_site
    skill_requirements { skill { name } }
    city { en name country { en name } }
    deadline
    entity { name }
  }
}`

export function afriworkJobUrl(id: string) {
  return `https://afriworket.com/jobs/${id}`
}

/**
 * The Telegram mini app landing on one vacancy: the page where the applicant's
 * saved CV and portfolio are already attached.
 */
export function afriworkApplyUrl(id: string) {
  return `https://t.me/afriworkapplicantbot/applicantapp?startapp=${id}`
}

type RawJob = {
  id: string
  title: string | null
  published_at: string | null
  refreshed_at: string | null
  latest_activity_at: string | null
  description: string | null
  job_type: string | null
  job_site: string | null
  skill_requirements: Array<{ skill: { name: string | null } | null }> | null
  city: {
    en: string | null
    name: string | null
    country: { en: string | null; name: string | null } | null
  } | null
  deadline: string | null
  entity: { name: string | null } | null
}

function place(city: RawJob["city"]) {
  if (!city) return null
  const name = city.en || city.name
  const country = city.country?.en || city.country?.name
  if (!name) return country ?? null
  return country ? `${name}, ${country}` : name
}

function toJob(raw: RawJob): AfriworkJob {
  const stamped =
    raw.published_at ?? raw.refreshed_at ?? raw.latest_activity_at ?? null
  const postedAt = stamped ? new Date(stamped) : null

  return {
    id: raw.id,
    title: raw.title?.trim() || null,
    description: raw.description?.trim() || null,
    deadline: raw.deadline,
    jobType: raw.job_type,
    jobSite: raw.job_site,
    company: raw.entity?.name?.trim() || null,
    location: place(raw.city),
    skills: (raw.skill_requirements ?? [])
      .map((row) => row.skill?.name?.trim())
      .filter((name): name is string => Boolean(name)),
    postedAt: postedAt && !Number.isNaN(postedAt.getTime()) ? postedAt : null,
  }
}

/**
 * The posting as text, laid out like a channel message so scoring and tailoring
 * see the same shape they already understand.
 */
export function afriworkText(job: AfriworkJob) {
  const lines = [job.title ?? "Job opening"]

  if (job.company) lines.push(`Company: ${job.company}`)
  if (job.location) lines.push(`Location: ${job.location}`)
  if (job.jobType || job.jobSite) {
    lines.push(
      `Type: ${[job.jobType, job.jobSite].filter(Boolean).join(" · ")}`
    )
  }
  if (job.skills.length > 0) lines.push(`Skills: ${job.skills.join(", ")}`)
  if (job.deadline) {
    const day = job.deadline.slice(0, 10)
    lines.push(`Deadline: ${day}`)
  }
  if (job.description) lines.push("", job.description)

  return lines.join("\n")
}

async function fetchPage(offset: number, titles: string[]): Promise<RawJob[]> {
  // The board is filtered by title on the server, so a scan sees the roles the
  // profile asks for instead of whatever was posted last.
  const titleFilter =
    titles.length > 0
      ? {
          _or: titles.map((title) => ({
            title: { _ilike: `%${title.replace(/[%_]/g, "")}%` },
          })),
        }
      : null
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // The site's own public role: this is the feed every visitor sees.
      "x-hasura-role": "anonymous",
      "user-agent": "job-apply-agent/1.0 (+https://afriworket.com)",
    },
    body: JSON.stringify({
      operationName: "GetAllJobs",
      variables: {
        offset,
        orderCondition: { latest_activity_at: "desc" },
        whereCondition: {
          _and: [
            { approval_status: { _in: ["PUBLISHED", "REFRESHED"] } },
            ...(titleFilter ? [titleFilter] : []),
          ],
        },
      },
      query: QUERY,
    }),
    signal: AbortSignal.timeout(20_000),
  })

  if (!response.ok) {
    throw new Error(`Afriwork returned HTTP ${response.status}`)
  }

  const body = (await response.json()) as {
    data?: { jobs?: RawJob[] }
    errors?: Array<{ message?: string }>
  }
  if (body.errors?.length) {
    throw new Error(body.errors[0]?.message ?? "Afriwork rejected the query")
  }
  return body.data?.jobs ?? []
}

/**
 * Reads up to `limit` open vacancies, newest first. When `titles` is given the
 * board is filtered to postings whose title matches one of them.
 */
export async function fetchAfriworkJobs(
  limit: number,
  titles: string[] = []
): Promise<AfriworkFetch> {
  if (limit <= 0) return { jobs: [], warnings: [] }

  const jobs: AfriworkJob[] = []
  const seen = new Set<string>()
  try {
    for (let offset = 0; offset < limit; offset += PAGE_SIZE) {
      const page = await fetchPage(offset, titles)
      for (const raw of page) {
        if (seen.has(raw.id)) continue
        seen.add(raw.id)
        jobs.push(toJob(raw))
      }
      if (page.length < PAGE_SIZE) break
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return {
      jobs,
      warnings: jobs.length > 0 ? [] : [`Afriwork: ${reason}`],
    }
  }

  return { jobs: jobs.slice(0, limit), warnings: [] }
}
