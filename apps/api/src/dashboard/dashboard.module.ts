import { Module } from "@nestjs/common"

import { AuthzModule } from "../authz/authz.module.js"
import { DashboardController } from "./dashboard.controller.js"
import { DashboardService } from "./dashboard.service.js"

@Module({
  imports: [AuthzModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
