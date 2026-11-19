import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { NotificationItem } from "@/features/notifications/notification-item"
import {
  type NotificationStatus,
  useMarkAllNotificationsAsRead,
  useNotifications,
} from "@/features/notifications/notifications-api"

export const Route = createFileRoute("/_main/notifications/")({
  component: NotificationsPage,
})

function NotificationsPage() {
  const [status, setStatus] = useState<NotificationStatus>("all")
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } =
    useNotifications(status)
  const markAll = useMarkAllNotificationsAsRead()
  const items = data?.pages.flatMap((page) => page.items) ?? []

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <PageHeader
        title="Notifications"
        subtitle="Recent updates for your account."
      />
      <div className="flex gap-2">
        <Button
          variant={status === "all" ? "default" : "outline"}
          onClick={() => setStatus("all")}
        >
          All
        </Button>
        <Button
          variant={status === "unread" ? "default" : "outline"}
          onClick={() => setStatus("unread")}
        >
          Unread
        </Button>
        <Button
          className="ml-auto"
          variant="outline"
          disabled={markAll.isPending}
          onClick={() => markAll.mutate()}
        >
          Mark all as read
        </Button>
      </div>
      <div className="rounded-md border">
        {isPending ? (
          <p className="p-4">Loading notifications…</p>
        ) : items.length ? (
          items.map((item) => (
            <NotificationItem key={item.id} item={item} showDelete />
          ))
        ) : (
          <p className="p-4 text-muted-foreground">No notifications.</p>
        )}
      </div>
      {hasNextPage && (
        <Button
          variant="outline"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          Load more
        </Button>
      )}
    </div>
  )
}
