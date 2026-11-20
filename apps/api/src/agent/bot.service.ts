import type { JobStatusInput } from "@et/contracts"
import { botMessage, db, jobPost, tenantWhere, user } from "@et/db"
import {
  HttpException,
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from "@nestjs/common"
import { and, count, desc, eq, like, lt, sql } from "drizzle-orm"
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
    message?: { message_id?: number; chat: { id: number } }
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

/** Ten postings per page, like the web list. */
const PAGE_SIZE = 10

/** `/jobs` is page one; any page outside 1..pages is clamped. */
export function jobPage(args: string, pages: number) {
  const asked = Number.parseInt(args.trim().split(/\s+/)[0] ?? "", 10)
  const page = Number.isNaN(asked) ? 1 : asked
  return Math.min(Math.max(1, pages), Math.max(1, page))
}

/** `1–10 of 23 · page 1 of 3` — the same totals the web list shows. */
export function pageLabel(page: number, pages: number, total: number) {
  const from = (page - 1) * PAGE_SIZE + 1
  const to = Math.min(total, page * PAGE_SIZE)
  return `${from}–${to} of ${total} · page ${page} of ${pages}`
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
    return Boolean(env.TELEGRAM_AGENT_BOT_TOKEN && this.allowedChats().size > 0)
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
    void this.forgetOldMessages()
    void this.publishMenuButton()
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

  /**
   * Every id in TELEGRAM_CHAT_ID (the owner's came first) plus any extra ids in
   * TELEGRAM_ALLOWED_CHAT_IDS. Commands work for all of them.
   */
  private allowedChats() {
    return new Set(
      `${env.TELEGRAM_CHAT_ID},${env.TELEGRAM_ALLOWED_CHAT_IDS}`
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    )
  }

  private async handle(update: TelegramUpdate) {
    const chatId =
      update.message?.chat.id ?? update.callback_query?.message?.chat.id
    if (chatId === undefined) return
    if (!this.allowedChats().has(String(chatId))) {
      // Say the id so the owner can allowlist it without reading logs.
      await this.reply(
        chatId,
        `This bot is private. Your chat id is <code>${chatId}</code> — give it to the owner and they can add it.`
      )
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
      if (action === "view" && id) {
        const job = await this.findJob(id)
        await this.reply(
          chatId,
          job ? formatJobCard(job) : "No posting matches that id.",
          job ? [buttonsFor(job)] : []
        )
      }
      if (action === "jobs") {
        // The pager edits the list in place instead of stacking messages.
        await this.sendJobs(chatId, id ?? "", callback.message?.message_id)
      }
      // A button that took too long to answer must not undo the work above.
      await this.call("answerCallbackQuery", {
        callback_query_id: callback.id,
      }).catch(() => undefined)
      return
    }

    const text = update.message?.text
    if (!text) return
    // The persistent keyboard sends plain labels, not commands.
    const parsed = parseCommand(text) ?? menuCommand(text)
    if (!parsed) return

    switch (parsed.command) {
      case "start":
      case "help":
        await this.reply(chatId, HELP, [], undefined, true)
        await this.sendOpenApp(chatId)
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
      case "clear":
        return await this.sendClear(chatId)
      case "app":
        return await this.sendOpenApp(chatId)
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

  /**
   * Every posting, newest score first, ten per page with Prev/Next — the same
   * set and totals the web list shows, so the two never disagree.
   */
  private async sendJobs(chatId: number, args: string, editMessageId?: number) {
    const [counted] = await db
      .select({ value: count() })
      .from(jobPost)
      .where(tenantWhere(jobPost.organizationId))
    const total = Number(counted?.value ?? 0)

    if (total === 0) {
      await this.reply(
        chatId,
        "No postings yet. Send /scan to read your channels."
      )
      return
    }

    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    const page = jobPage(args, pages)
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
      .where(tenantWhere(jobPost.organizationId))
      .orderBy(desc(jobPost.score), desc(jobPost.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE)

    const now = new Date()
    await this.reply(
      chatId,
      [
        `<b>Postings</b> · ${pageLabel(page, pages, total)}`,
        ...rows.map((job) => formatJobLine(job, now)),
      ].join("\n"),
      [...rows.map((job) => buttonsFor(job)), navRow(page, pages)],
      editMessageId
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

  /**
   * Puts the web app behind the persistent menu button beside the chat box, so
   * the full console is one tap away from any chat.
   */
  private async publishMenuButton() {
    const url = env.TELEGRAM_WEBAPP_URL
    if (!url) return
    await this.call("setChatMenuButton", {
      menu_button: {
        type: "web_app",
        text: "Open app",
        web_app: { url },
      },
    }).catch((error) =>
      this.logger.warn(`Menu button unchanged: ${describe(error)}`)
    )
  }

  /** A tappable card that opens the mini app inside Telegram. */
  private async sendOpenApp(chatId: number) {
    const url = env.TELEGRAM_WEBAPP_URL
    if (!url) return
    await this.call("sendMessage", {
      chat_id: chatId,
      text: "Open the full console inside Telegram:",
      reply_markup: {
        inline_keyboard: [[{ text: "Open app", web_app: { url } }]],
      },
    }).then(
      () => undefined,
      (error) => this.logger.warn(`Open app button failed: ${describe(error)}`)
    )
  }

  /** Deletes what this bot posted here, so a long chat can start clean. */
  private async sendClear(chatId: number) {
    const rows = await db
      .select({ messageId: botMessage.messageId })
      .from(botMessage)
      .where(eq(botMessage.chatId, String(chatId)))

    let deleted = 0
    for (const row of rows) {
      const ok = await this.call("deleteMessage", {
        chat_id: chatId,
        message_id: row.messageId,
      }).then(
        () => true,
        () => false
      )
      if (ok) deleted++
    }
    await db.delete(botMessage).where(eq(botMessage.chatId, String(chatId)))

    // Telegram refuses deletions after 48 hours, so name what is left behind.
    const left = rows.length - deleted
    await this.reply(
      chatId,
      [
        `<b>Chat cleared</b> · ${deleted} message(s) removed`,
        ...(left > 0
          ? [`${left} older than 48h cannot be deleted by a bot.`]
          : []),
      ].join("\n"),
      [],
      undefined,
      true
    )
  }

  /** Keeps the tracked list from growing past Telegram's delete window. */
  private async forgetOldMessages() {
    await db
      .delete(botMessage)
      .where(lt(botMessage.sentAt, new Date(Date.now() - 48 * 60 * 60_000)))
      .catch(() => undefined)
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

  /**
   * Sends a message, or edits one already in the chat so paging does not pile
   * up messages. An edit that Telegram refuses falls back to a fresh message.
   */
  private async reply(
    chatId: number,
    text: string,
    keyboard: Button[][] = [],
    editMessageId?: number,
    menu = false
  ) {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text: text.slice(0, 4_000),
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...(menu
        ? { reply_markup: { keyboard: MENU, resize_keyboard: true } }
        : keyboard.length > 0
          ? { reply_markup: { inline_keyboard: keyboard } }
          : {}),
    }
    if (editMessageId !== undefined) {
      const edited = await this.call("editMessageText", {
        ...payload,
        message_id: editMessageId,
      }).catch(() => null)
      if (edited) {
        await this.remember(chatId, editMessageId)
        return
      }
    }
    const sent = (await this.call("sendMessage", payload)) as {
      result?: { message_id?: number }
    }
    await this.remember(chatId, sent.result?.message_id)
  }

  private async remember(chatId: number, messageId?: number) {
    if (typeof messageId !== "number") return
    await db
      .insert(botMessage)
      .values({ id: crypto.randomUUID(), chatId: String(chatId), messageId })
      .catch((error) =>
        this.logger.warn(`Message not tracked: ${describe(error)}`)
      )
  }
}

/** The persistent keyboard, sent with /start and /help. */
const MENU = [
  [{ text: "Postings" }, { text: "Closing soon" }],
  [{ text: "Open app" }, { text: "Scan" }],
  [{ text: "Clear" }],
]

/** Keyboard labels are plain text; map them to the commands they stand for. */
export function menuCommand(text: string) {
  const key = text.trim().toLowerCase()
  const map: Record<string, string> = {
    postings: "jobs",
    jobs: "jobs",
    "closing soon": "closing",
    closing: "closing",
    scan: "scan",
    "scan now": "scan",
    clear: "clear",
    "clear chat": "clear",
    "open app": "app",
    app: "app",
  }
  const command = map[key]
  return command ? { command, args: "" } : null
}

const HELP = [
  "<b>Job agent</b>",
  "Use the buttons below, or type:",
  "/closing — postings closing soon",
  "/jobs [page] — every posting, 10 per page",
  "/job &lt;id&gt; — one posting in full",
  "/applied &lt;id&gt; — mark it applied (stops reminders)",
  "/scan — read your channels again",
  "/clear — delete this bot's messages here",
  "/app — open the full console inside Telegram",
].join("\n")

const short = (title: string | null) =>
  (title ?? "posting").split(/\s+/).slice(0, 3).join(" ").slice(0, 20)

function buttonsFor(job: JobRow): Button[] {
  // Details always exists, so a posting without a channel link still has
  // something to tap.
  const buttons: Button[] = []
  if (job.url) buttons.push({ text: "Open", url: job.url })
  buttons.push({ text: "Details", callback_data: `view:${job.id}` })
  if (job.status !== "applied") {
    buttons.push({ text: "✓ Applied", callback_data: `applied:${job.id}` })
  }
  return buttons
}

function navRow(page: number, pages: number): Button[] {
  if (pages === 1) return [{ text: `${page}/${pages}`, callback_data: "noop" }]
  return [
    { text: "◀ Prev", callback_data: `jobs:${page - 1}` },
    { text: `${page}/${pages}`, callback_data: "noop" },
    { text: "Next ▶", callback_data: `jobs:${page + 1}` },
  ]
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
