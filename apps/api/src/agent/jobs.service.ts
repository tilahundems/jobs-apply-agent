import { AuthzService, an } from "@et/authz"
import type { JobListQuery, JobStatusInput } from "@et/contracts"
import { JOB_STATUS_LABELS } from "@et/contracts"
import {
  type CandidateProfile,
  candidateProfile,
  db,
  jobPost,
  requiredOrganizationId,
  tenantWhere,
} from "@et/db"
import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common"
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  lt,
  max,
  or,
  type SQL,
  sql,
} from "drizzle-orm"
import { type AuditRecorder, InjectAudit } from "../common/audit.port.js"
import {
  dateFilter,
  likeMatches,
  matchingEnumValues,
  paginate,
  textFilter,
} from "../common/list-query.js"
import { apiError } from "../http/api-error.js"
import { markdownToDocx } from "./docx.js"
import { scoreJob } from "./match.js"
import { isDeadlinePassed, parseJob } from "./parse.js"
import { type NewPosting, RemindersService } from "./reminders.service.js"
import { tailorApplication } from "./tailor.js"
import { fetchChannelPosts } from "./telegram-source.js"

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

/** Shape returned by `summary`: the numbers the agent console renders. */
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
  top: Array<{
    id: string
    title: string | null
    company: string | null
    location: string | null
    channel: string
    url: string | null
    score: number
    status: string
    reasons: string[]
    gaps: string[]
    matchedSkills: string[]
    deadlineAt: string | null
    createdAt: string
  }>
}

/** SQLite returns raw column values for aggregates; normalise them to ISO. */
function toIso(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const date =
    value instanceof Date ? value : new Date(value as string | number)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const jobColumns = {
  id: true,
  externalKey: true,
  channel: true,
  messageId: true,
  postedAt: true,
  deadlineAt: true,
  title: true,
  company: true,
  location: true,
  url: true,
  rawText: true,
  score: true,
  blocked: true,
  status: true,
  reasons: true,
  gaps: true,
  matchedSkills: true,
  tailoredCv: true,
  coverLetter: true,
  preparedAt: true,
  appliedAt: true,
  createdAt: true,
  updatedAt: true,
} as const

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name)

  constructor(
    @Inject(AuthzService) private readonly authz: AuthzService,
    @Inject(RemindersService) private readonly reminders: RemindersService,
    @InjectAudit() private readonly audit?: AuditRecorder
  ) {}

  async list(query: JobListQuery, conditions: SQL) {
    const filters: SQL[] = [conditions, tenantWhere(jobPost.organizationId)]

    if (query.search) {
      const search = or(
        likeMatches(jobPost.title, query.search),
        likeMatches(jobPost.company, query.search),
        likeMatches(jobPost.channel, query.search)
      )
      if (search) filters.push(search)
    }

    for (const rule of query.filter) {
      if (rule.field === "createdAt") {
        filters.push(dateFilter(jobPost.createdAt, rule))
      } else if (rule.field === "status") {
        const values = matchingEnumValues(JOB_STATUS_LABELS, rule)
        filters.push(
          values.length > 0
            ? inArray(jobPost.status, values)
            : eq(jobPost.status, "new")
        )
      } else if (rule.field === "company") {
        filters.push(textFilter(jobPost.company, rule))
      } else if (rule.field === "channel") {
        filters.push(textFilter(jobPost.channel, rule))
      } else {
        filters.push(textFilter(jobPost.title, rule))
      }
    }

    const sortColumn =
      query.sort.field === "title"
        ? jobPost.title
        : query.sort.field === "company"
          ? jobPost.company
          : query.sort.field === "postedAt"
            ? jobPost.postedAt
            : query.sort.field === "createdAt"
              ? jobPost.createdAt
              : jobPost.score

    const where = and(...filters)
    const order = query.sort.direction === "asc" ? asc : desc

    return await paginate(
      query,
      async (window) =>
        await db.query.jobPost.findMany({
          columns: jobColumns,
          where,
          orderBy: [
            order(sortColumn),
            desc(jobPost.createdAt),
            asc(jobPost.id),
          ],
          ...window,
        }),
      () => db.select({ value: count() }).from(jobPost).where(where)
    )
  }

  /**
   * Aggregates for the agent console: how much the agent kept, how strong it
   * is, which channels actually produce, and the best postings right now.
   */
  async summary(conditions: SQL): Promise<JobSummary> {
    const where = and(
      conditions,
      tenantWhere(jobPost.organizationId),
      eq(jobPost.blocked, false)
    )

    const profile = await this.currentProfile()

    const [statusRows, totals, channelRows, topRows] = await Promise.all([
      db
        .select({ status: jobPost.status, value: count() })
        .from(jobPost)
        .where(where)
        .groupBy(jobPost.status),
      db
        .select({
          total: count(),
          bestScore: max(jobPost.score),
          lastFoundAt: max(jobPost.createdAt),
          strong: sql<number>`sum(case when ${jobPost.score} >= 70 then 1 else 0 end)`,
        })
        .from(jobPost)
        .where(where),
      db
        .select({
          channel: jobPost.channel,
          total: count(),
          bestScore: max(jobPost.score),
          lastFoundAt: max(jobPost.createdAt),
        })
        .from(jobPost)
        .where(where)
        .groupBy(jobPost.channel)
        .orderBy(desc(max(jobPost.score)), desc(count())),
      db.query.jobPost.findMany({
        columns: {
          id: true,
          title: true,
          company: true,
          location: true,
          channel: true,
          url: true,
          score: true,
          status: true,
          reasons: true,
          gaps: true,
          matchedSkills: true,
          deadlineAt: true,
          createdAt: true,
        },
        where,
        // The console opens on what the last scan found, not on the best score.
        orderBy: [desc(jobPost.createdAt), desc(jobPost.score)],
        limit: 5,
      }),
    ])

    const byStatus = { new: 0, prepared: 0, applied: 0, dismissed: 0 }
    for (const row of statusRows) {
      if (row.status in byStatus) {
        byStatus[row.status as keyof typeof byStatus] = row.value
      }
    }

    const total = totals[0]?.total ?? 0

    return {
      total,
      strong: totals[0]?.strong ?? 0,
      bestScore: totals[0]?.bestScore ?? 0,
      lastFoundAt: toIso(totals[0]?.lastFoundAt),
      minMatchScore: profile?.preferences.minMatchScore ?? 0,
      byStatus,
      watched: profile?.sources.channels ?? [],
      channels: channelRows.map((row) => ({
        channel: row.channel,
        total: row.total,
        bestScore: row.bestScore ?? 0,
        lastFoundAt: toIso(row.lastFoundAt),
      })),
      top: topRows.map((row) => ({
        ...row,
        status: row.status,
        deadlineAt: row.deadlineAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
    }
  }

  async findOne(id: string, conditions: SQL) {
    const row = await db.query.jobPost.findFirst({
      columns: jobColumns,
      where: (table, { and: andOp, eq: eqOp }) =>
        andOp(
          conditions,
          tenantWhere(table.organizationId),
          eqOp(table.id, id)
        ),
    })

    if (!row) {
      apiError(HttpStatus.NOT_FOUND, "Job not found")
    }

    return row
  }

  /** Records the user's decision. The agent never applies on its own. */
  async setStatus(
    userId: string,
    id: string,
    input: JobStatusInput,
    conditions: SQL
  ) {
    const existing = await this.findOne(id, conditions)

    const [row] = await db
      .update(jobPost)
      .set({
        status: input.status,
        appliedAt: input.status === "applied" ? new Date() : null,
      })
      .where(
        and(tenantWhere(jobPost.organizationId), eq(jobPost.id, existing.id))
      )
      .returning({ id: jobPost.id, status: jobPost.status })

    if (!row) {
      apiError(HttpStatus.NOT_FOUND, "Job not found")
    }

    await this.audit?.record({
      actorId: userId,
      actorType: "USER",
      action: "JOB_STATUS_CHANGED",
      resourceType: "job_post",
      resourceId: row.id,
      oldValues: { status: existing.status },
      newValues: { status: row.status },
    })

    return this.findOne(id, conditions)
  }

  /** Writes the tailored CV and cover letter for one posting. */
  async prepare(userId: string, id: string, conditions: SQL) {
    const job = await this.findOne(id, conditions)

    if (job.blocked) {
      apiError(
        HttpStatus.BAD_REQUEST,
        "This posting was rejected by your exclusion keywords, so there is nothing to prepare."
      )
    }

    const profile = await this.currentProfile()
    if (!profile) {
      apiError(HttpStatus.BAD_REQUEST, "Set up your profile first.")
    }

    await this.authz.assert(
      userId,
      "update",
      an("JobPost", job as unknown as Record<string, unknown>),
      ["tailoredCv", "coverLetter", "status"]
    )

    const tailoring = await tailorApplication(profile, job)

    await db
      .update(jobPost)
      .set({
        tailoredCv: tailoring.cv,
        coverLetter: tailoring.coverLetter,
        status: "prepared",
        preparedAt: new Date(),
      })
      .where(and(tenantWhere(jobPost.organizationId), eq(jobPost.id, job.id)))

    await this.audit?.record({
      actorId: userId,
      actorType: "USER",
      action: "JOB_APPLICATION_PREPARED",
      resourceType: "job_post",
      resourceId: job.id,
      newValues: { status: "prepared" },
    })

    return this.findOne(id, conditions)
  }

  async cvDocx(id: string, conditions: SQL): Promise<Buffer> {
    const job = await this.findOne(id, conditions)
    if (!job.tailoredCv) {
      apiError(
        HttpStatus.BAD_REQUEST,
        "Prepare the application before downloading the CV."
      )
    }
    return markdownToDocx(job.tailoredCv)
  }

  /**
   * Reads every configured channel and stores the postings that score at or
   * above the profile threshold. Safe to run repeatedly: duplicates are ignored
   * by the (organization, external key) index.
   */
  async ingest(): Promise<IngestSummary> {
    const profile = await this.currentProfile()
    if (!profile) {
      apiError(HttpStatus.BAD_REQUEST, "Set up your profile first.")
    }

    const channels = profile.sources.channels
    if (channels.length === 0) {
      apiError(
        HttpStatus.BAD_REQUEST,
        "Add at least one Telegram channel to your profile."
      )
    }

    const summary: IngestSummary = {
      channels: channels.length,
      fetched: 0,
      added: 0,
      belowThreshold: 0,
      excluded: 0,
      expired: 0,
      warnings: [],
    }

    // A posting that closed is not a lead. Clear the stored ones before reading
    // channels again, so the list never keeps work that cannot be applied to.
    // Reminder messages go first: deleting a posting also drops the reminder row
    // that holds the Telegram message id.
    await this.reminders.clearExpired()
    const dropped = await db
      .delete(jobPost)
      .where(
        and(
          tenantWhere(jobPost.organizationId),
          lt(jobPost.deadlineAt, new Date())
        )
      )
      .returning({ id: jobPost.id })
    summary.expired = dropped.length

    // Announcements are collected here because only the scan knows what is new.
    const fresh: NewPosting[] = []

    const existing = new Set(
      (
        await db.query.jobPost.findMany({
          columns: { externalKey: true },
          where: tenantWhere(jobPost.organizationId),
        })
      ).map((row) => row.externalKey)
    )

    for (const channel of channels) {
      const result = await fetchChannelPosts(
        channel,
        profile.sources.messagesPerChannel
      )
      summary.warnings.push(...result.warnings)

      for (const post of result.posts) {
        summary.fetched += 1
        if (existing.has(post.key)) continue

        const parsed = parseJob(post.text)
        if (isDeadlinePassed(parsed.deadlineAt)) {
          summary.expired += 1
          continue
        }

        const match = scoreJob(post.text, parsed, {
          skills: profile.skills,
          preferences: profile.preferences,
        })

        if (match.blocked) {
          summary.excluded += 1
          continue
        }

        if (match.score < profile.preferences.minMatchScore) {
          summary.belowThreshold += 1
          continue
        }

        const created = await db
          .insert(jobPost)
          .values({
            id: crypto.randomUUID(),
            organizationId: requiredOrganizationId(),
            externalKey: post.key,
            channel: post.channel,
            messageId: post.messageId,
            postedAt: post.postedAt,
            deadlineAt: parsed.deadlineAt,
            title: parsed.title,
            company: parsed.company,
            location: parsed.location,
            url: post.url,
            rawText: post.text,
            score: match.score,
            blocked: false,
            status: "new",
            reasons: match.reasons,
            gaps: match.gaps,
            matchedSkills: match.matchedSkills,
          })
          .onConflictDoNothing()
          .returning({ id: jobPost.id })

        existing.add(post.key)
        if (created.length === 0) continue

        summary.added += 1
        fresh.push({
          title: parsed.title,
          company: parsed.company,
          location: parsed.location,
          url: post.url,
          deadlineAt: parsed.deadlineAt,
          score: match.score,
        })
      }
    }

    // A failed announcement must not fail the scan: the postings are stored,
    // and the app already shows them.
    try {
      await this.reminders.announceNew(fresh)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`New-posting notification skipped: ${message}`)
    }

    return summary
  }

  async currentProfile(): Promise<CandidateProfile | null> {
    return (
      (await db.query.candidateProfile.findFirst({
        where: tenantWhere(candidateProfile.organizationId),
      })) ?? null
    )
  }
}
