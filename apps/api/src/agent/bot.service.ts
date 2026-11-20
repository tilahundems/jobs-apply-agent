import type { JobStatusInput } from "@et/contracts"
import { db, jobPost, tenantWhere, user } from "@et/db"
import {
  HttpException,
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from "@nestjs/common"
import { and, desc, eq, like, sql } from "drizzle-orm"
import { env } from "../env.js"
import { JobsService } from "./jobs.service.js"
import { RemindersService } from "./reminders.service.js"
import { escapeHtml, telegramCall } from "./telegram-api.js"

/** Telegram's own update shape, trimmed to what this bot reads. */
type TelegramUpdate = {
  update_id: number
  message?: { chat: { id: number }; text?: string }
  callback_query?: {
    id: string
    data?: string
    message?: { chat: { id: number } }
  }
}

type JobRow = {
  id: string
  title: string | null
  company: string | null
  location: string | null
  url: string | null
  score: number
  status: string
  deadlineAt: Date | null
}

type Button = { text: string; url?: string; callback_data?: string }

const DAY_MS = 86_400_000
const idle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const closingLabel = (daysLeft: number) =>
  daysLeft === 0
    ? "closes today"
    : daysLeft === 1
      ? "closes tomorrow"
      : `closes in ${daysLeft} days`

/** `"/jobs@my_bot 3"` becomes `{ command: "jobs", args: "3" }`. */
export function parseCommand(text: string) {
  if (!text.startsWith("/")) return null
  const [raw = "", ...rest] = text.trim().split(/\s+/)
  const command = raw.slice(1).split("@")[0]?.toLowerCase() ?? ""
  return command ? { command, args: rest.join(" ") } : null
}

/** A posting as one line: title, company, score, and when it closes. */
export function formatJobLine(job: JobRow, now = new Date()) {
  const when =
    job.deadlineAt === null
      ? "no deadline"
      : closingLabel(
          Math.max(
            0,
            Math.floor((job.deadlineAt.getTime() - now.getTime()) / DAY_MS)
          )
        )
  const where = job.company ? ` · ${escapeHtml(job.company)}` : ""
  const status = job.status === "new" ? "" : ` (${escapeHtml(job.status)})`
  return `• <b>${escapeHtml(job.title ?? "Untitled posting")}</b>${where} — ${job.score}% · ${when}${status}`
}

/** One posting in full, with the facts needed to decide. */
export function formatJobCard(job: JobRow, now = new Date()) {
  const lines = [`<b>${escapeHtml(job.title ?? "Untitled posting")}</b>`]
  const where = [job.company, job.location].filter(Boolean).join(" · ")
  if (where) lines.push(escapeHtml(where))
  lines.push(`Match: ${job.score}% · Status: ${escapeHtml(job.status)}`)
  if (job.deadlineAt) {
    const daysLeft = Math.max(
      0,
      Math.floor((job.deadlineAt.getTime() - now.getTime()) / DAY_MS)
    )
    lines.push(
      `Deadline: ${job.deadlineAt.toISOString().slice(0, 10)} (${closingLabel(daysLeft)})`
    )
  } else {
    lines.push("Deadline: not stated")
  }
  lines.push(`<code>${escapeHtml(job.id)}</code>`)
  return lines.join("\n")
}

/** A short id is enough to refer to a posting from the phone. */
export function isJobRef(value: string) {
  return /^[0-9a-f-]{4,36}$/i.test(value)
}

/**
 * Reads and answers messages as a bot of its own, so the reminder bot stays a
 * one-way notifier and the agent is usable from a phone without the web app.
 * Long polling is used on purpose: it needs no public HTTPS endpoint. Only the
 * configured chat may talk to it.
 */
@Injectable()
export class BotService implements OnModuleDestroy {
  private readonly logger = new Logger(BotService.name)
  private offset = 0
  private running = false
  private stopped = false

  constructor(
    @Inject(JobsService) private readonly jobs: JobsService,
    @Inject(RemindersService) private readonly reminders: RemindersService
  ) {}

  get enabled() {
    return Boolean(env.TELEGRAM_AGENT_BOT_TOKEN && env.TELEGRAM_CHAT_ID)
  }

  /** Every call goes to the command bot's token, never the reminder bot's. */
  private call(
    method: string,
    payload: Record<string, unknown>,
    timeoutMs?: number
  ) {
    return telegramCall(
      method,
      payload,
      timeoutMs,
      env.TELEGRAM_AGENT_BOT_TOKEN
    )
  }

  /** Starts the polling loop once; safe to call from the scheduler. */
  start() {
    if (!this.enabled || this.running) return
    this.running = true
    this.stopped = false
    this.logger.log("Listening for commands in the authorized chat.")
    void this.loop()
  }

  onModuleDestroy() {
    this.stopped = true
  }

  private async loop() {
    while (!this.stopped) {
      try {
        const updates = await this.getUpdates()
        for (const update of updates) {
          try {
            await this.handle(update)
          } catch (error) {
            this.logger.warn(`Update skipped: ${describe(error)}`)
          }
        }
      } catch (error) {
        // A 409 here means something else is polling the same token.
        this.logger.warn(`Polling paused: ${describe(error)}`)
        await idle(5_000)
      }
    }
  }

  private async getUpdates() {
    const body = await this.call(
      "getUpdates",
      {
        offset: this.offset,
        timeout: 20,
        allowed_updates: ["message", "callback_query"],
      },
      30_000
    )
    const updates = Array.isArray(body.result)
      ? (body.result as TelegramUpdate[])
      : []
    for (const update of updates) {
      this.offset = Math.max(this.offset, update.update_id + 1)
    }
    return updates
  }

  private async handle(update: TelegramUpdate) {
    const chatId =
      update.message?.chat.id ?? update.callback_query?.message?.chat.id
    if (chatId === undefined) return
    if (String(chatId) !== env.TELEGRAM_CHAT_ID) {
      await this.reply(chatId, "This bot is private.")
      return
    }

    if (update.callback_query) {
      const callback = update.callback_query
      const [action, id] = (callback.data ?? "").split(":")
      if (action === "applied" && id) {
        const job = await this.botApply(id)
        await this.reply(
          chatId,
          `Marked applied: <b>${escapeHtml(job.title ?? "posting")}</b>`
        )
      }
      // A button that took too long to answer must not undo the work above.
      await this.call("answerCallbackQuery", {
        callback_query_id: callback.id,
      }).catch(() => undefined)
      return
    }

    const text = update.message?.text
    if (!text) return
    const parsed = parseCommand(text)
    if (!parsed) return

    switch (parsed.command) {
      case "start":
      case "help":
        await this.reply(chatId, HELP)
        return
      case "closing":
        return await this.sendClosing(chatId)
      case "jobs":
        return await this.sendJobs(chatId, parsed.args)
      case "job":
        return await this.sendJob(chatId, parsed.args)
      case "applied":
        return await this.sendApplied(chatId, parsed.args)
      case "scan":
        return await this.sendScan(chatId)
      default:
        await this.reply(
          chatId,
          "Unknown command. Send /help for what I can do."
        )
    }
  }

  private async sendClosing(chatId: number) {
    const upcoming = await this.reminders.upcoming()
    if (upcoming.length === 0) {
      await this.reply(
        chatId,
        `Nothing closes in the next ${env.DEADLINE_REMINDER_DAYS} day(s).`
      )
      return
    }
    const lines = upcoming.map(
      (job) =>
        `• <b>${escapeHtml(job.title ?? "Untitled posting")}</b>${
          job.company ? ` · ${escapeHtml(job.company)}` : ""
        } — ${closingLabel(job.daysLeft)}`
    )
    await this.reply(
      chatId,
      [`<b>Closing soon</b>`, ...lines].join("\n"),
      upcoming
        .filter((job) => job.url)
        .slice(0, 5)
        .map((job) => [{ text: `Open ${short(job.title)}`, url: job.url! }])
    )
  }

  private async sendJobs(chatId: number, args: string) {
    const asked = Number(args.trim().split(/\s+/)[0])
    const limit = Number.isFinite(asked) ? Math.min(10, Math.max(1, asked)) : 5
    const rows = await db
      .select({
        id: jobPost.id,
        title: jobPost.title,
        company: jobPost.company,
        location: jobPost.location,
        url: jobPost.url,
        score: jobPost.score,
        status: jobPost.status,
        deadlineAt: jobPost.deadlineAt,
      })
      .from(jobPost)
      .where(
        and(
          tenantWhere(jobPost.organizationId),
          sql`${jobPost.status} in ('new', 'prepared')`
        )
      )
      .orderBy(desc(jobPost.score), desc(jobPost.createdAt))
      .limit(limit)

    if (rows.length === 0) {
      await this.reply(
        chatId,
        "No open postings yet. Send /scan to read your channels."
      )
      return
    }

    const now = new Date()
    await this.reply(
      chatId,
      [
        `<b>Best open postings</b>`,
        ...rows.map((job) => formatJobLine(job, now)),
      ].join("\n"),
      rows.map((job) => buttonsFor(job))
    )
  }

  private async sendJob(chatId: number, args: string) {
    const ref = args.trim().split(/\s+/)[0]
    if (!ref || !isJobRef(ref)) {
      await this.reply(
        chatId,
        "Usage: <code>/job &lt;id&gt;</code> — the id is shown by /jobs."
      )
      return
    }
    const job = await this.findJob(ref)
    if (!job) {
      await this.reply(chatId, "No posting matches that id.")
      return
    }
    await this.reply(chatId, formatJobCard(job), [buttonsFor(job)])
  }

  private async sendApplied(chatId: number, args: string) {
    const ref = args.trim().split(/\s+/)[0]
    if (!ref || !isJobRef(ref)) {
      await this.reply(chatId, "Usage: <code>/applied &lt;id&gt;</code>")
      return
    }
    const job = await this.botApply(ref)
    await this.reply(
      chatId,
      `Marked applied: <b>${escapeHtml(job.title ?? "posting")}</b>`
    )
  }

  private async sendScan(chatId: number) {
    const summary = await this.jobs.ingest()
    const lines = [
      `<b>Scan finished</b>`,
      `${summary.added} new from ${summary.fetched} messages in ${summary.channels} channel(s).`,
      `${summary.belowThreshold} below your threshold · ${summary.excluded} excluded · ${summary.expired} expired`,
    ]
    for (const warning of summary.warnings.slice(0, 5)) {
      lines.push(`⚠️ ${escapeHtml(warning)}`)
    }
    await this.reply(chatId, lines.join("\n"))
  }

  private async botApply(ref: string) {
    const job = await this.findJob(ref)
    if (!job) throw new Error("No posting matches that id.")
    const [actor] = await db.select({ id: user.id }).from(user).limit(1)
    const input: JobStatusInput = { status: "applied" }
    await this.jobs.setStatus(
      actor?.id ?? "telegram",
      job.id,
      input,
      sql`1 = 1`
    )
    return job
  }

  private async findJob(ref: string): Promise<JobRow | null> {
    const rows = await db
      .select({
        id: jobPost.id,
        title: jobPost.title,
        company: jobPost.company,
        location: jobPost.location,
        url: jobPost.url,
        score: jobPost.score,
        status: jobPost.status,
        deadlineAt: jobPost.deadlineAt,
      })
      .from(jobPost)
      .where(
        and(
          tenantWhere(jobPost.organizationId),
          ref.length === 36 ? eq(jobPost.id, ref) : like(jobPost.id, `${ref}%`)
        )
      )
      .limit(1)
    return rows[0] ?? null
  }

  private async reply(chatId: number, text: string, keyboard: Button[][] = []) {
    await this.call("sendMessage", {
      chat_id: chatId,
      text: text.slice(0, 4_000),
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...(keyboard.length > 0
        ? { reply_markup: { inline_keyboard: keyboard } }
        : {}),
    })
  }
}

const HELP = [
  "<b>Job agent</b>",
  "/closing — postings closing soon",
  "/jobs [n] — best open postings",
  "/job &lt;id&gt; — one posting in full",
  "/applied &lt;id&gt; — mark it applied (stops reminders)",
  "/scan — read your channels again",
].join("\n")

const short = (title: string | null) =>
  (title ?? "posting").split(/\s+/).slice(0, 3).join(" ").slice(0, 20)

function buttonsFor(job: JobRow): Button[] {
  const buttons: Button[] = []
  if (job.url) buttons.push({ text: "Open", url: job.url })
  if (job.status !== "applied") {
    buttons.push({ text: "Applied", callback_data: `applied:${job.id}` })
  }
  return buttons
}

function describe(error: unknown) {
  if (error instanceof HttpException) {
    const response = error.getResponse()
    if (typeof response === "object" && response && "error" in response) {
      return String((response as { error: unknown }).error)
    }
  }
  return error instanceof Error ? error.message : String(error)
}
