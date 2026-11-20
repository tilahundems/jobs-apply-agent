import { sql } from "drizzle-orm"
import { rootDb } from "@et/db"
import { BotService } from "./src/agent/bot.service.js"
import { JobsService } from "./src/agent/jobs.service.js"
import { RemindersService } from "./src/agent/reminders.service.js"

const chatId = Number(process.env.TELEGRAM_CHAT_ID)
const reminders = new RemindersService()
const jobs = new JobsService({} as never, reminders)
const bot = new BotService(jobs, reminders)
type H = { handle: (u: unknown) => Promise<void> }
const deliver = (update: unknown) => (bot as unknown as H).handle(update)

const row = await rootDb.run(
  sql.raw(
    "SELECT id, title, url FROM job_post WHERE status = 'new' ORDER BY score DESC LIMIT 1"
  )
)
const job = row.rows[0] as { id: string; title: string | null; url: string | null }
console.log("target:", job.title, "| url:", job.url)

try {
  await deliver({
    update_id: 2,
    callback_query: {
      id: "fake",
      data: `view:${job.id}`,
      message: { chat: { id: chatId } },
    },
  })
  console.log("Details card delivered")
} catch (error) {
  console.log("FAILED:", error instanceof Error ? error.message : error)
  const response = (error as { getResponse?: () => unknown }).getResponse?.()
  console.log("response:", JSON.stringify(response))
}
process.exit(0)
