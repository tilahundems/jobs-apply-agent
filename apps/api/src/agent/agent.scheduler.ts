import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common"
import { env } from "../env.js"
import { JobsService } from "./jobs.service.js"

/**
 * Reads the configured channels on an interval. Off unless
 * AGENT_INGEST_MINUTES is greater than zero, so a fresh checkout never starts
 * calling Telegram or the database on its own.
 */
@Injectable()
export class AgentScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgentScheduler.name)
  private timer: NodeJS.Timeout | undefined
  private running = false

  constructor(@Inject(JobsService) private readonly jobs: JobsService) {}

  onModuleInit() {
    const minutes = env.AGENT_INGEST_MINUTES
    if (minutes <= 0) return

    this.logger.log(`Scanning Telegram channels every ${minutes} minute(s).`)
    this.timer = setInterval(() => void this.tick(), minutes * 60_000)
    this.timer.unref?.()
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`Ingest skipped: ${message}`)
    } finally {
      this.running = false
    }
  }
}
