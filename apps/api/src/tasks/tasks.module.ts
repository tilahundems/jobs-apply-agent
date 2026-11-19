import { Module } from "@nestjs/common"

import { AuthzModule } from "../authz/authz.module.js"
import { NotificationsModule } from "../notifications/notifications.module.js"
import { TasksController } from "./tasks.controller.js"
import { TasksService } from "./tasks.service.js"

@Module({
  imports: [AuthzModule, NotificationsModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
