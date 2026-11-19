import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useEffect } from "react"
import { api } from "@/lib/api"

export type Notification = {
  id: string
  userId: string
  type: string
  title: string
  message: string
  data: Record<string, unknown> | null
  actionUrl: string | null
  readAt: string | null
  createdAt: string
  updatedAt: string
}

export type NotificationPage = {
  items: Notification[]
  nextCursor: string | null
}
export type NotificationStatus = "all" | "unread"
export const notificationKeys = {
  all: ["notifications"] as const,
  list: (status: NotificationStatus, limit: number) =>
    ["notifications", "list", status, limit] as const,
  count: ["notifications", "count"] as const,
}

export const notificationsQueryOptions = (
  status: NotificationStatus = "all",
  limit = 20
) =>
  infiniteQueryOptions({
    queryKey: notificationKeys.list(status, limit),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ status, limit: String(limit) })
      if (pageParam) params.set("cursor", pageParam)
      return api<NotificationPage>(`/api/v1/notifications?${params}`)
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

export const unreadNotificationCountQueryOptions = queryOptions({
  queryKey: notificationKeys.count,
  queryFn: () => api<{ count: number }>("/api/v1/notifications/unread-count"),
})

export function useNotifications(
  status: NotificationStatus = "all",
  limit = 20
) {
  return useInfiniteQuery(notificationsQueryOptions(status, limit))
}

export function useUnreadNotificationCount() {
  return useQuery(unreadNotificationCountQueryOptions)
}

function useChange(mutationFn: (id: string) => Promise<unknown>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () =>
      client.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}

export function useMarkNotificationAsRead() {
  return useChange((id) =>
    api(`/api/v1/notifications/${encodeURIComponent(id)}/read`, {
      method: "PATCH",
    })
  )
}

export function useDeleteNotification() {
  return useChange((id) =>
    api(`/api/v1/notifications/${encodeURIComponent(id)}`, { method: "DELETE" })
  )
}

export function useMarkAllNotificationsAsRead() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api("/api/v1/notifications/read-all", { method: "PATCH" }),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}

export function useNotificationStream() {
  const client = useQueryClient()
  useEffect(() => {
    const base =
      (import.meta.env.VITE_API_URL as string | undefined)?.replace(
        /\/$/,
        ""
      ) ?? ""
    const source = new EventSource(`${base}/api/v1/notifications/stream`, {
      withCredentials: true,
    })
    const refresh = () => {
      void client.invalidateQueries({ queryKey: notificationKeys.all })
    }
    source.addEventListener("notification.created", refresh)
    source.addEventListener("notification.changed", refresh)
    return () => {
      source.removeEventListener("notification.created", refresh)
      source.removeEventListener("notification.changed", refresh)
      source.close()
    }
  }, [client])
}
