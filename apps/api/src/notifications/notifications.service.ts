import {
  currentOrganizationId,
  db,
  notification,
  requiredOrganizationId,
  SINGLE_TENANT_ID,
  tenantWhere,
} from "@et/db"
import { HttpStatus, Inject, Injectable } from "@nestjs/common"
import { and, count, desc, eq, isNull, lt, or } from "drizzle-orm"
import { apiError } from "../http/api-error.js"
import type {
  NotificationInput,
  NotificationQuery,
} from "./notification-input.js"
import { NotificationStreamService } from "./notification-stream.service.js"

function decodeCursor(value: string) {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString()
    )
    if (
      !Array.isArray(parsed) ||
      parsed.length !== 2 ||
      typeof parsed[0] !== "string" ||
      typeof parsed[1] !== "string"
    )
      throw new Error()
    const date = new Date(parsed[0])
    if (Number.isNaN(date.getTime()) || !/^[0-9a-f-]{36}$/i.test(parsed[1]))
      throw new Error()
    return { date, id: parsed[1] }
  } catch {
    apiError(HttpStatus.BAD_REQUEST, "Invalid notification cursor")
  }
}

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NotificationStreamService)
    private readonly stream: NotificationStreamService
  ) {}

  async notify(input: NotificationInput) {
    const [created] = await db
      .insert(notification)
      .values({
        id: crypto.randomUUID(),
        ...input,
        organizationId: currentOrganizationId() ?? SINGLE_TENANT_ID,
      })
      .returning()
    if (!created)
      apiError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Unable to create notification"
      )
    this.stream.publish(
      created.userId,
      "notification.created",
      {
        id: created.id,
      },
      created.organizationId
    )
    return created
  }

  async notifyMany(inputs: NotificationInput[]) {
    if (inputs.length === 0) return []
    const created = await db
      .insert(notification)
      .values(
        inputs.map((input) => ({
          id: crypto.randomUUID(),
          ...input,
          organizationId: currentOrganizationId() ?? SINGLE_TENANT_ID,
        }))
      )
      .returning()
    for (const item of created)
      this.stream.publish(
        item.userId,
        "notification.created",
        {
          id: item.id,
        },
        item.organizationId
      )
    return created
  }

  async list(userId: string, query: NotificationQuery) {
    const cursor = query.cursor ? decodeCursor(query.cursor) : null
    const where = and(
      eq(notification.userId, userId),
      tenantWhere(notification.organizationId),
      query.status === "unread" ? isNull(notification.readAt) : undefined,
      cursor
        ? or(
            lt(notification.createdAt, cursor.date),
            and(
              eq(notification.createdAt, cursor.date),
              lt(notification.id, cursor.id)
            )
          )
        : undefined
    )
    const rows = await db
      .select()
      .from(notification)
      .where(where)
      .orderBy(desc(notification.createdAt), desc(notification.id))
      .limit(query.limit + 1)
    const items = rows.slice(0, query.limit)
    const last = items.at(-1)
    return {
      items,
      nextCursor:
        rows.length > query.limit && last
          ? Buffer.from(
              JSON.stringify([last.createdAt.toISOString(), last.id])
            ).toString("base64url")
          : null,
    }
  }

  async unreadCount(userId: string) {
    const [row] = await db
      .select({ value: count() })
      .from(notification)
      .where(
        and(
          tenantWhere(notification.organizationId),
          eq(notification.userId, userId),
          isNull(notification.readAt)
        )
      )
    return { count: row?.value ?? 0 }
  }

  async markAsRead(userId: string, id: string) {
    const [row] = await db
      .update(notification)
      .set({ readAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(notification.id, id),
          tenantWhere(notification.organizationId),
          eq(notification.userId, userId),
          isNull(notification.readAt)
        )
      )
      .returning()
    if (row) {
      this.stream.publish(
        userId,
        "notification.changed",
        { id },
        row.organizationId
      )
      return row
    }
    const [existing] = await db
      .select()
      .from(notification)
      .where(
        and(
          tenantWhere(notification.organizationId),
          eq(notification.id, id),
          eq(notification.userId, userId)
        )
      )
      .limit(1)
    if (!existing) apiError(HttpStatus.NOT_FOUND, "Notification not found")
    return existing
  }

  async markAllAsRead(userId: string) {
    const rows = await db
      .update(notification)
      .set({ readAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          tenantWhere(notification.organizationId),
          eq(notification.userId, userId),
          isNull(notification.readAt)
        )
      )
      .returning({ id: notification.id })
    if (rows.length)
      this.stream.publish(
        userId,
        "notification.changed",
        {},
        requiredOrganizationId()
      )
    return { updated: rows.length }
  }

  async delete(userId: string, id: string) {
    const [row] = await db
      .delete(notification)
      .where(
        and(
          tenantWhere(notification.organizationId),
          eq(notification.id, id),
          eq(notification.userId, userId)
        )
      )
      .returning({ id: notification.id })
    if (!row) apiError(HttpStatus.NOT_FOUND, "Notification not found")
    this.stream.publish(
      userId,
      "notification.changed",
      { id },
      requiredOrganizationId()
    )
    return { id }
  }
}
