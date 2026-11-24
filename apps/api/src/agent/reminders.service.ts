import {
  db,
  deadlineReminder,
  type JobStatus,
  jobPost,
  tenantWhere,
} from "@et/db"
import { HttpStatus, Injectable, Logger } from "@nestjs/common"
import {
  and,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  lte,
  notInArray,
} from "drizzle-orm"
import { env } from "../env.js"
import { apiError } from "../http/api-error.js"
import { escapeHtml, telegramCall, telegramChatIds } from "./telegram-api.js"

const DAY_MS = 86_400_000
/** Postings the user has already dealt with need no warning. */
const SETTLED_STATUSES: JobStatus[] = ["applied", "dismissed", "blocked"]

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

/** A posting the latest scan added, as the announcement needs it. */
export type NewPosting = {
  title: string | null
  company: string | null
  location: string | null
  url: string | null
  deadlineAt: Date | null
  score: number | null
}

/** How many postings one announcement lists before pointing at the app. */
const ANNOUNCED_PER_MESSAGE = 10

/**
 * One message for a scan's worth of postings. A scan can find a dozen at once,
 * and a dozen notifications are noise, so they arrive as a single digest.
 */
export function formatNewJobs(rows: NewPosting[]) {
  const shown = rows.slice(0, ANNOUNCED_PER_MESSAGE)
  const lines = [
    `<b>🆕 ${rows.length} new posting${rows.length === 1 ? "" : "s"}</b>`,
  ]

  shown.forEach((row, index) => {
    const score = row.score === null ? "" : ` — ${row.score}% match`
    lines.push("")
    lines.push(
      `${index + 1}. <b>${escapeHtml(row.title ?? "Untitled posting")}</b>${score}`
    )
    const where = [row.company, row.location].filter(Boolean).join(" · ")
    if (where) lines.push(escapeHtml(where))
    if (row.deadlineAt) lines.push(`Closes ${closingDate(row.deadlineAt)}`)
    if (row.url) lines.push(escapeHtml(row.url))
  })

  const hidden = rows.length - shown.length
  if (hidden > 0) lines.push("", `…and ${hidden} more in the app.`)
  return lines.join("\n")
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

  /**
   * Everyone a message goes to: the owner first, then any extra ids in
   * TELEGRAM_ALLOWED_CHAT_IDS. A friend who has sent the bot a message and
   * whose id is listed there gets the same closing-date warnings.
   */
  private get recipients() {
    return telegramChatIds(env.TELEGRAM_CHAT_ID, env.TELEGRAM_ALLOWED_CHAT_IDS)
  }

  get enabled() {
    return Boolean(env.TELEGRAM_BOT_TOKEN && this.recipients.length > 0)
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
        url: jobPost.url,
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
              url: row.url,
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

  /**
   * Announces the postings a scan just added. They go to the same chat as the
   * closing-date warnings, so a scan reaches the phone instead of waiting for
   * someone to open the app.
   */
  async announceNew(rows: NewPosting[]) {
    if (!this.enabled || rows.length === 0) return 0
    await this.send(formatNewJobs(rows))
    return rows.length
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

  /** Sends the current window again, even for postings already announced. */
  async sendNow() {
    this.assertEnabled()
    return await this.run(true)
  }

  /**
   * The postings each chat has already been warned about. Rows written before
   * reminders were tracked per chat belong to the owner, who is listed first.
   */
  private async announced() {
    const owner = this.recipients[0] ?? ""
    const rows = await db
      .select({
        jobPostId: deadlineReminder.jobPostId,
        chatId: deadlineReminder.chatId,
      })
      .from(deadlineReminder)
      .where(tenantWhere(deadlineReminder.organizationId))
    return new Set(rows.map((row) => `${row.jobPostId}|${row.chatId || owner}`))
  }

  /** Messages every open posting that closes inside the reminder window. */
  async run(force = false) {
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
        .where(this.window(now, horizon))

      const chats = this.recipients
      const announced = force ? new Set<string>() : await this.announced()

      let sent = 0
      for (const row of rows) {
        const deadlineAt = row.deadlineAt
        if (!deadlineAt) continue
        const daysLeft = daysLeftUntil(deadlineAt, now)
        for (const chatId of chats) {
          if (announced.has(`${row.id}|${chatId}`)) continue
          let messageId: number | null = null
          try {
            messageId = await this.sendTo(chatId, formatReminder(row, daysLeft))
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error)
            this.logger.warn(
              `Reminder skipped for ${row.id} in chat ${chatId}: ${message}`
            )
            continue
          }
          await db
            .insert(deadlineReminder)
            .values({
              id: crypto.randomUUID(),
              organizationId: row.organizationId,
              jobPostId: row.id,
              chatId,
              daysLeft,
              messageId,
            })
            // A resend replaces the message the chat holds, so keep the new id.
            .onConflictDoUpdate({
              target: [
                deadlineReminder.organizationId,
                deadlineReminder.jobPostId,
                deadlineReminder.chatId,
              ],
              set: { messageId, daysLeft, sentAt: new Date() },
            })
          sent += 1
        }
      }

      if (sent) this.logger.log(`Sent ${sent} closing-date reminder(s).`)
      return { sent, enabled: true }
    } finally {
      this.running = false
    }
  }

  /**
   * Deletes the bot's messages for postings whose closing date has passed, so
   * the chat only holds work that can still be applied to. Telegram refuses
   * deletions older than 48 hours; those are left alone and forgotten.
   */
  async clearExpired() {
    if (!this.enabled) return { cleared: 0 }
    const rows = await db
      .select({
        id: deadlineReminder.id,
        chatId: deadlineReminder.chatId,
        messageId: deadlineReminder.messageId,
      })
      .from(deadlineReminder)
      .innerJoin(jobPost, eq(jobPost.id, deadlineReminder.jobPostId))
      .where(
        and(
          tenantWhere(deadlineReminder.organizationId),
          lt(jobPost.deadlineAt, new Date())
        )
      )
    if (rows.length === 0) return { cleared: 0 }

    const owner = this.recipients[0] ?? ""
    for (const row of rows) {
      if (row.messageId === null) continue
      try {
        await this.deleteMessage(row.chatId || owner, row.messageId)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.logger.warn(`Earlier reminder kept: ${message}`)
      }
    }

    await db.delete(deadlineReminder).where(
      inArray(
        deadlineReminder.id,
        rows.map((row) => row.id)
      )
    )
    return { cleared: rows.length }
  }

  /**
   * The same message to every chat. One blocked or removed chat must not stop
   * the others, so each delivery is reported on its own.
   */
  private async send(text: string) {
    const sent: { chatId: string; messageId: number | null }[] = []
    for (const chatId of this.recipients) {
      try {
        sent.push({ chatId, messageId: await this.sendTo(chatId, text) })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.logger.warn(`Could not message chat ${chatId}: ${message}`)
      }
    }
    return sent
  }

  private async sendTo(chatId: string, text: string) {
    const body = await telegramCall("sendMessage", {
      chat_id: chatId,
      text: text.slice(0, 4_000),
      parse_mode: "HTML",
    })
    const messageId = (body as { result?: { message_id?: unknown } }).result
      ?.message_id
    return typeof messageId === "number" ? messageId : null
  }

  private async deleteMessage(chatId: string, messageId: number) {
    await telegramCall("deleteMessage", {
      chat_id: chatId,
      message_id: messageId,
    })
  }

  private assertEnabled() {
    if (this.enabled) return
    apiError(
      HttpStatus.BAD_REQUEST,
      "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to send reminders"
    )
  }
}
