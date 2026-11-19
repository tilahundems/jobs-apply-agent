import type { Page } from "@et/contracts"
import { queryOptions } from "@tanstack/react-query"
import { api, json } from "@/lib/api"
import { type ListQuery, listQueryString } from "@/lib/table-search-params"

export type JobStatus = "new" | "prepared" | "applied" | "dismissed" | "blocked"

export type Job = {
  id: string
  externalKey: string
  channel: string
  messageId: number | null
  postedAt: string | null
  deadlineAt: string | null
  title: string | null
  company: string | null
  location: string | null
  url: string | null
  rawText: string
  score: number
  blocked: boolean
  status: JobStatus
  reasons: string[]
  gaps: string[]
  matchedSkills: string[]
  tailoredCv: string | null
  coverLetter: string | null
  preparedAt: string | null
  appliedAt: string | null
  createdAt: string
  updatedAt: string
}

export type IngestSummary = {
  channels: number
  fetched: number
  added: number
  belowThreshold: number
  excluded: number
  /** Postings dropped or skipped because their deadline has passed. */
  expired: number
  warnings: string[]
}

const apiOrigin =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? ""

export async function listJobs(
  query: ListQuery = { page: 1, perPage: 20 }
): Promise<Page<Job>> {
  return await api<Page<Job>>(`/api/v1/jobs?${listQueryString(query)}`)
}

export async function getJob(id: string): Promise<Job> {
  return await api<Job>(`/api/v1/jobs/${encodeURIComponent(id)}`)
}

export async function ingestJobs(): Promise<IngestSummary> {
  return await api<IngestSummary>("/api/v1/jobs/ingest", { method: "POST" })
}

export async function prepareJob(id: string): Promise<Job> {
  return await api<Job>(`/api/v1/jobs/${encodeURIComponent(id)}/prepare`, {
    method: "POST",
  })
}

export async function setJobStatus(
  id: string,
  status: Exclude<JobStatus, "blocked">
): Promise<Job> {
  return await api<Job>(
    `/api/v1/jobs/${encodeURIComponent(id)}`,
    json("PATCH", { status })
  )
}

/** One posting inside the console's best-match list. */
export type JobMatch = {
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
  deadlineAt: string | null
  createdAt: string
}

/** Aggregates behind the agent console. */
export type JobSummary = {
  total: number
  strong: number
  bestScore: number
  lastFoundAt: string | null
  minMatchScore: number
  byStatus: Record<"new" | "prepared" | "applied" | "dismissed", number>
  watched: string[]
  channels: Array<{
    channel: string
    total: number
    bestScore: number
    lastFoundAt: string | null
  }>
  top: JobMatch[]
}

export function jobCvUrl(id: string) {
  return `${apiOrigin}/api/v1/jobs/${encodeURIComponent(id)}/cv.docx`
}

export const jobPageQueryOptions = (query: ListQuery) =>
  queryOptions({
    queryKey: ["jobs", "page", query] as const,
    queryFn: () => listJobs(query),
  })

export const jobSummaryQueryOptions = queryOptions({
  queryKey: ["jobs", "summary"] as const,
  queryFn: () => api<JobSummary>("/api/v1/jobs/summary"),
})

export const jobQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["jobs", id] as const,
    queryFn: () => getJob(id),
  })
