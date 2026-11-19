import { Link } from "@tanstack/react-router"
import { BellIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { NotificationItem } from "./notification-item"
import {
  useMarkAllNotificationsAsRead,
  useNotificationStream,
  useNotifications,
  useUnreadNotificationCount,
} from "./notifications-api"

export function NotificationBell() {
  useNotificationStream()
  const { data: count } = useUnreadNotificationCount()
  const { data } = useNotifications("all", 5)
  const markAll = useMarkAllNotificationsAsRead()
  const items = data?.pages.flatMap((page) => page.items) ?? []

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon-sm" className="relative" />}
      >
        <BellIcon />
        <span className="sr-only">Notifications</span>
        {!!count?.count && (
          <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
            {count.count > 99 ? "99+" : count.count}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between p-3">
          <PopoverTitle>Notifications</PopoverTitle>
          <Button
            size="sm"
            variant="ghost"
            disabled={!count?.count || markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            Mark all as read
          </Button>
        </div>
        <div className="max-h-96 overflow-auto">
          {items.length ? (
            items.map((item) => <NotificationItem key={item.id} item={item} />)
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
              No notifications yet.
            </p>
          )}
        </div>
        <div className="border-t p-2 text-center text-sm">
          <Link to="/notifications">View all notifications</Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
