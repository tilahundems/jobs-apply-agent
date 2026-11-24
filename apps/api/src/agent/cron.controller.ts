import { createHash, timingSafeEqual } from "node:crypto"
import {
  Controller,
  Headers,
  Inject,
  Logger,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common"
import { SkipThrottle } from "@nestjs/throttler"
import { AllowAnonymous } from "@thallesp/nestjs-better-auth"
import { env } from "../env.js"
import { JobsService } from "./jobs.service.js"

const digest = (value: string) => createHash("sha256").update(value).digest()

/**
 * Lets an outside scheduler start a scan.
 *
 * A free host sleeps when nothing calls it and a sleeping process runs no
 * timers, so the background loop alone cannot keep a deployed agent current.
 * A scheduled request both wakes the instance and scans it. The path takes no
 * session, so it is protected by a shared secret instead: without CRON_SECRET
 * set it refuses to run at all.
 */
@AllowAnonymous()
@SkipThrottle()
@Controller("cron")
export class CronController {
  private readonly logger = new Logger(CronController.name)
  private scanning = false

  constructor(@Inject(JobsService) private readonly jobs: JobsService) {}

  @Post("scan")
  async scan(@Headers("x-cron-secret") secret: string | undefined) {
    if (!env.CRON_SECRET) {
      throw new ServiceUnavailableException(
        "Set CRON_SECRET to allow scheduled scans."
      )
    }
    if (!secret || !timingSafeEqual(digest(secret), digest(env.CRON_SECRET))) {
      throw new UnauthorizedException("Wrong scan secret.")
    }

    // Schedules can overlap a slow channel read; one scan at a time is enough.
    if (this.scanning) return { started: false, reason: "scan already running" }

    this.scanning = true
    try {
      const summary = await this.jobs.ingest()
      this.logger.log(
        `Scheduled scan: ${summary.added} new from ${summary.fetched} messages.`
      )
      return { started: true, summary }
    } finally {
      this.scanning = false
    }
  }
}
