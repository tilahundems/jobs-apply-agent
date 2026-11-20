import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common"
import { env } from "../env.js"
import { JobsService } from "./jobs.service.js"
import { RemindersService } from "./reminders.service.js"

/**
 * Reads the configured channels on an interval. Off unless
 * AGENT_INGEST_MINUTES is greater than zero, so a fresh checkout never starts
 * calling Telegram or the database on its own.
 *
 * Closing-date reminders run on their own timer because they must keep working
 * when scanning is disabled.
 */
@Injectable()
export class AgentScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgentScheduler.name)
  private timer: NodeJS.Timeout | undefined
  private reminderTimer: NodeJS.Timeout | undefined
  private running = false
  private reminding = false

  constructor(
    @Inject(JobsService) private readonly jobs: JobsService,
    @Inject(RemindersService) private readonly reminders: RemindersService
  ) {}

  onModuleInit() {
    const minutes = env.AGENT_INGEST_MINUTES
    if (minutes > 0) {
      this.logger.log(`Scanning Telegram channels every ${minutes} minute(s).`)
      this.timer = setInterval(() => void this.tick(), minutes * 60_000)
      this.timer.unref?.()
    }

    const reminderMinutes = env.DEADLINE_CHECK_MINUTES
    if (reminderMinutes > 0 && this.reminders.enabled) {
      this.logger.log(
        `Checking closing dates every ${reminderMinutes} minute(s).`
      )
      void this.checkDeadlines()
      this.reminderTimer = setInterval(
        () => void this.checkDeadlines(),
        reminderMinutes * 60_000
      )
      this.reminderTimer.unref?.()
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
    if (this.reminderTimer) clearInterval(this.reminderTimer)
  }

  private async tick() {
    if (this.running) return
    this.running = true
    try {
      const summary = await this.jobs.ingest()
      this.logger.log(
        `Ingest finished: ${summary.added} new from ${summary.fetched} messages.`
      )
      for (const warning of summary.warnings) this.logger.warn(warning)
      // Announce anything newly ingested that already closes soon.
      await this.checkDeadlines()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`Ingest skipped: ${message}`)
    } finally {
      this.running = false
    }
  }

  private async checkDeadlines() {
    if (this.reminding) return
    this.reminding = true
    try {
      // Clear the chat of postings that have closed, then warn about the rest.
      await this.reminders.clearExpired()
      await this.reminders.run()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`Closing-date check skipped: ${message}`)
    } finally {
      this.reminding = false
    }
  }
}
