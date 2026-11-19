import { queryOptions } from "@tanstack/react-query"
import { api } from "@/lib/api"

export type AuditLog = {
  id: string
  createdAt: string
  actorId: string | null
  actorType: string
  actorName: string | null
  actorEmail: string | null
  status: "success" | "failed"
  action: string
  resourceType: string
  resourceId: string
  organizationId: string | null
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  requestId: string | null
  ipAddress: string | null
  userAgent: string | null
}

export type AuditPage = { items: AuditLog[]; total: number }

import type { AuditSearch } from "./audit-search-params"

export function auditLogsQueryOptions(search: AuditSearch) {
  const params = new URLSearchParams({
    page: String(search.page),
    perPage: String(search.perPage),
    sort: search.sort,
  })
  for (const key of [
    "q",
    "actor",
    "action",
    "resourceType",
    "status",
  ] as const) {
    if (search[key])
      params.set(
        key,
        key === "action" ? search[key].replace(/\s+/g, "_") : search[key]
      )
  }
  if (search.from)
    params.set("from", new Date(`${search.from}T00:00:00`).toISOString())
  if (search.to)
    params.set("to", new Date(`${search.to}T23:59:59.999`).toISOString())
  return queryOptions({
    queryKey: ["audit-logs", search],
    queryFn: () => api<AuditPage>(`/api/v1/audit-logs?${params}`),
  })
}
