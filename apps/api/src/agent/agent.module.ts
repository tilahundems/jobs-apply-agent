import { Module } from "@nestjs/common"
import { AuthzModule } from "../authz/authz.module.js"
import { AgentScheduler } from "./agent.scheduler.js"
import { JobsController } from "./jobs.controller.js"
import { JobsService } from "./jobs.service.js"
import { ProfileController } from "./profile.controller.js"
import { ProfileService } from "./profile.service.js"

@Module({
  imports: [AuthzModule],
  controllers: [JobsController, ProfileController],
  providers: [JobsService, ProfileService, AgentScheduler],
})
export class AgentModule {}
