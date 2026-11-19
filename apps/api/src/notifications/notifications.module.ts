import { Module } from "@nestjs/common"
import { NotificationStreamService } from "./notification-stream.service.js"
import { NotificationsController } from "./notifications.controller.js"
import { NotificationsService } from "./notifications.service.js"

@Module({
  controllers: [NotificationsController],
  providers: [NotificationStreamService, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
