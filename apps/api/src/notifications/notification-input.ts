import { z } from "zod"

export const notificationQuerySchema = z.object({
  status: z.enum(["all", "unread"]).default("all"),
  cursor: z.string().max(300).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type NotificationQuery = z.infer<typeof notificationQuerySchema>

export type NotificationInput = {
  userId: string
  type: string
  title: string
  message: string
  data?: Record<string, unknown> | null
  actionUrl?: string | null
}
