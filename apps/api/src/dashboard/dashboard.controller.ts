import { Controller, Get, Inject } from "@nestjs/common"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"

import { DashboardService } from "./dashboard.service.js"

@Controller("dashboard")
export class DashboardController {
  constructor(
    @Inject(DashboardService) private readonly dashboard: DashboardService
  ) {}

  @Get()
  summary(@Session() session: UserSession) {
    return this.dashboard.summary(session.user.id)
  }
}
