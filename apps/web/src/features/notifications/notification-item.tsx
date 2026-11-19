import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  type Notification,
  useDeleteNotification,
  useMarkNotificationAsRead,
} from "./notifications-api"

export function NotificationItem({
  item,
  showDelete = false,
}: {
  item: Notification
  showDelete?: boolean
}) {
  const markRead = useMarkNotificationAsRead()
  const remove = useDeleteNotification()

  async function open() {
    if (!item.readAt) await markRead.mutateAsync(item.id)
    if (item.actionUrl?.startsWith("/") && !item.actionUrl.startsWith("//"))
      window.location.assign(item.actionUrl)
  }

  return (
    <div
      className={cn(
        "flex items-start gap-2 border-b p-3 last:border-b-0",
        !item.readAt && "bg-accent/40"
      )}
    >
      <button
        type="button"
        onClick={() => void open()}
        className="min-w-0 flex-1 text-left"
        aria-label={`Open notification: ${item.title}`}
      >
        <span className="block font-medium">{item.title}</span>
        <span className="block text-sm text-muted-foreground line-clamp-2">
          {item.message}
        </span>
        <span className="block text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
        </span>
      </button>
      {showDelete && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => remove.mutate(item.id)}
          disabled={remove.isPending}
        >
          Delete
        </Button>
      )}
    </div>
  )
}
