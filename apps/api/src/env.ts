import process from "node:process"
import { dbEnv } from "@et/db"
import { z } from "zod"

// Importing @et/db loads the repository root .env first.

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  /** Minutes between automatic channel scans. 0 disables the background loop. */
  AGENT_INGEST_MINUTES: z.coerce.number().int().min(0).default(0),
  /**
   * Telegram bot used for closing-date warnings. Create one by messaging
   * @BotFather, then send it a message and read the chat id from
   * https://api.telegram.org/bot<token>/getUpdates. Empty disables sending.
   */
  TELEGRAM_BOT_TOKEN: z.string().default(""),
  /**
   * A second bot, from @BotFather, that answers commands instead of sending
   * warnings. Keeping it separate means a chat with the notifier stays
   * one-way. Empty disables the command bot.
   */
  TELEGRAM_AGENT_BOT_TOKEN: z.string().default(""),
  /** The only chat allowed to use the command bot; also where replies go. */
  TELEGRAM_CHAT_ID: z.string().default(""),
  /** Warn this many days before a posting closes. */
  DEADLINE_REMINDER_DAYS: z.coerce.number().int().min(0).max(30).default(3),
  /** Minutes between closing-date checks. 0 disables the background loop. */
  DEADLINE_CHECK_MINUTES: z.coerce.number().int().min(0).default(30),
})

export const env = {
  ...schema.parse(process.env),
  MULTI_TENANCY: dbEnv.MULTI_TENANCY,
}
