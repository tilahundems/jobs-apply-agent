import { SINGLE_TENANT_ID } from "@et/db"
import {
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Query,
  Sse,
} from "@nestjs/common"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"
import { env } from "../env.js"
import {
  type NotificationQuery,
  notificationQuerySchema,
} from "./notification-input.js"
import { NotificationStreamService } from "./notification-stream.service.js"
import { NotificationsService } from "./notifications.service.js"

@Controller("notifications")
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
    @Inject(NotificationStreamService)
    private readonly stream: NotificationStreamService
  ) {}

  @Get()
  list(
    @Session() session: UserSession,
    @Query({ schema: notificationQuerySchema }) query: NotificationQuery
  ) {
    return this.notifications.list(session.user.id, query)
  }

  @Get("unread-count")
  unreadCount(@Session() session: UserSession) {
    return this.notifications.unreadCount(session.user.id)
  }

  @Patch("read-all")
  readAll(@Session() session: UserSession) {
    return this.notifications.markAllAsRead(session.user.id)
  }

  @Patch(":id/read")
  read(@Session() session: UserSession, @Param("id") id: string) {
    return this.notifications.markAsRead(session.user.id, id)
  }

  @Delete(":id")
  delete(@Session() session: UserSession, @Param("id") id: string) {
    return this.notifications.delete(session.user.id, id)
  }

  @Sse("stream")
  events(@Session() session: UserSession) {
    return this.stream.stream(
      session.user.id,
      env.MULTI_TENANCY
        ? ((session.session as { activeOrganizationId?: string | null })
            .activeOrganizationId ?? "")
        : SINGLE_TENANT_ID
    )
  }
}
