import { Controller, Get, Inject, Res, VERSION_NEUTRAL } from "@nestjs/common"
import { SkipThrottle } from "@nestjs/throttler"
import { AllowAnonymous } from "@thallesp/nestjs-better-auth"
import type { Response } from "express"

import { MetricsService } from "./metrics.service.js"

@AllowAnonymous()
@SkipThrottle()
@Controller({ version: VERSION_NEUTRAL })
export class MetricsController {
  constructor(
    @Inject(MetricsService) private readonly metrics: MetricsService
  ) {}

  @Get("metrics")
  async getMetrics(@Res({ passthrough: true }) response: Response) {
    response.type(this.metrics.registry.contentType)
    return this.metrics.registry.metrics()
  }
}
