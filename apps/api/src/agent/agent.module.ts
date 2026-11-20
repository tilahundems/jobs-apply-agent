import { Module } from "@nestjs/common"
import { AuthzModule } from "../authz/authz.module.js"
import { AgentScheduler } from "./agent.scheduler.js"
import { BotService } from "./bot.service.js"
import { JobsController } from "./jobs.controller.js"
import { JobsService } from "./jobs.service.js"
import { ProfileController } from "./profile.controller.js"
import { ProfileService } from "./profile.service.js"
import { RemindersController } from "./reminders.controller.js"
import { RemindersService } from "./reminders.service.js"

@Module({
  imports: [AuthzModule],
  controllers: [JobsController, ProfileController, RemindersController],
  providers: [
    JobsService,
    ProfileService,
    RemindersService,
    BotService,
    AgentScheduler,
  ],
})
export class AgentModule {}
