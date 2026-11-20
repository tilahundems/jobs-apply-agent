import {
  db,
  deadlineReminder,
  type JobStatus,
  jobPost,
  tenantWhere,
} from "@et/db"
import { HttpStatus, Injectable, Logger } from "@nestjs/common"
import { and, eq, gte, isNotNull, isNull, lte, notInArray } from "drizzle-orm"
import { env } from "../env.js"
import { apiError } from "../http/api-error.js"

const DAY_MS = 86_400_000
/** Postings the user has already dealt with need no warning. */
const SETTLED_STATUSES: JobStatus[] = ["applied", "dismissed", "blocked"]

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/** Whole days from `now` until `deadline`; 0 means it closes today. */
export const daysLeftUntil = (deadline: Date, now: Date) =>
  Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / DAY_MS))

type ReminderJob = {
  title: string | null
  company: string | null
  location: string | null
  url: string | null
  deadlineAt: Date | null
}

/** The Telegram message for one posting, in Telegram's HTML subset. */
export function formatReminder(row: ReminderJob, daysLeft: number) {
  const when =
    daysLeft === 0
      ? "closes today"
      : daysLeft === 1
        ? "closes tomorrow"
        : `closes in ${daysLeft} days`
  const lines = [`<b>⏰ ${escapeHtml(row.title ?? "A posting")} — ${when}</b>`]
  const where = [row.company, row.location].filter(Boolean).join(" · ")
  if (where) lines.push(escapeHtml(where))
  if (row.deadlineAt) lines.push(`Deadline: ${closingDate(row.deadlineAt)}`)
  if (row.url) lines.push(escapeHtml(row.url))
  return lines.join("\n")
}

const closingDate = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Addis_Ababa",
  }).format(date)

/** Telegram's `description` is the useful half of its error body. */
export const telegramDetail = (body: string) => {
  try {
    const parsed = JSON.parse(body) as { description?: unknown }
    if (typeof parsed.description === "string") return parsed.description
  } catch {
    // Fall through to the raw body.
  }
  return body.slice(0, 200) || "no reason given"
}

/**
 * Warns over Telegram when a posting is about to close. A bot costs nothing and
 * reaches a phone, and every posting is announced once at most: the
 * `deadline_reminder` row records it, so a restart or a later check the same
 * day never repeats the message.
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name)
  private running = false

  get enabled() {
    return Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID)
  }

  async status() {
    return {
      enabled: this.enabled,
      days: env.DEADLINE_REMINDER_DAYS,
      checkMinutes: env.DEADLINE_CHECK_MINUTES,
      upcoming: await this.upcoming(),
    }
  }

  /** The open postings a reminder is due for, nearest closing date first. */
  async upcoming() {
    const now = new Date()
    const horizon = new Date(
      now.getTime() + env.DEADLINE_REMINDER_DAYS * DAY_MS
    )
    const rows = await db
      .select({
        id: jobPost.id,
        title: jobPost.title,
        company: jobPost.company,
        deadlineAt: jobPost.deadlineAt,
        sentAt: deadlineReminder.sentAt,
      })
      .from(jobPost)
      .leftJoin(deadlineReminder, eq(deadlineReminder.jobPostId, jobPost.id))
      .where(this.window(now, horizon))
      .orderBy(jobPost.deadlineAt)
      .limit(10)

    return rows.flatMap((row) =>
      row.deadlineAt
        ? [
            {
              id: row.id,
              title: row.title,
              company: row.company,
              deadlineAt: row.deadlineAt,
              daysLeft: daysLeftUntil(row.deadlineAt, now),
              reminded: row.sentAt !== null,
            },
          ]
        : []
    )
  }

  /** Postings that close inside the window and still need an answer. */
  private window(now: Date, horizon: Date) {
    return and(
      tenantWhere(jobPost.organizationId),
      isNotNull(jobPost.deadlineAt),
      gte(jobPost.deadlineAt, now),
      lte(jobPost.deadlineAt, horizon),
      notInArray(jobPost.status, SETTLED_STATUSES)
    )
  }

  async sendTest() {
    this.assertEnabled()
    await this.send(
      [
        "<b>Closing-date reminders are on.</b>",
        `You will get a message ${env.DEADLINE_REMINDER_DAYS} day(s) before a posting closes.`,
      ].join("\n")
    )
    return { sent: true }
  }

  /** Messages every open posting that closes inside the reminder window. */
  async run() {
    if (!this.enabled) return { sent: 0, enabled: false }
    if (this.running) return { sent: 0, enabled: true }
    this.running = true
    try {
      const now = new Date()
      const horizon = new Date(
        now.getTime() + env.DEADLINE_REMINDER_DAYS * DAY_MS
      )
      const rows = await db
        .select({
          id: jobPost.id,
          organizationId: jobPost.organizationId,
          title: jobPost.title,
          company: jobPost.company,
          location: jobPost.location,
          url: jobPost.url,
          deadlineAt: jobPost.deadlineAt,
        })
        .from(jobPost)
        .leftJoin(deadlineReminder, eq(deadlineReminder.jobPostId, jobPost.id))
        .where(and(this.window(now, horizon), isNull(deadlineReminder.id)))

      let sent = 0
      for (const row of rows) {
        const deadlineAt = row.deadlineAt
        if (!deadlineAt) continue
        const daysLeft = daysLeftUntil(deadlineAt, now)
        try {
          await this.send(formatReminder(row, daysLeft))
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          this.logger.warn(`Reminder skipped for ${row.id}: ${message}`)
          continue
        }
        await db
          .insert(deadlineReminder)
          .values({
            id: crypto.randomUUID(),
            organizationId: row.organizationId,
            jobPostId: row.id,
            daysLeft,
          })
          .onConflictDoNothing()
        sent += 1
      }

      if (sent) this.logger.log(`Sent ${sent} closing-date reminder(s).`)
      return { sent, enabled: true }
    } finally {
      this.running = false
    }
  }

  private async send(text: string) {
    const response = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: text.slice(0, 4_000),
          parse_mode: "HTML",
        }),
        signal: AbortSignal.timeout(15_000),
      }
    )
    if (!response.ok) {
      const detail = await response.text().catch(() => "")
      throw apiError(
        HttpStatus.BAD_GATEWAY,
        `Telegram rejected the message: ${telegramDetail(detail)}`
      )
    }
  }

  private assertEnabled() {
    if (this.enabled) return
    apiError(
      HttpStatus.BAD_REQUEST,
      "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to send reminders"
    )
  }
}
