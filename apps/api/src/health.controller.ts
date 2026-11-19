import { Controller, Get, VERSION_NEUTRAL } from "@nestjs/common"
import { SkipThrottle } from "@nestjs/throttler"
import { AllowAnonymous } from "@thallesp/nestjs-better-auth"

@AllowAnonymous()
@SkipThrottle()
@Controller({ version: VERSION_NEUTRAL })
export class HealthController {
  @Get("health")
  health() {
    return { ok: true }
  }
}
