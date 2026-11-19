import { useQuery } from "@tanstack/react-query"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { createColumnHelper, useTable } from "@tanstack/react-table"
import { useMemo, useState } from "react"
import { DataTable, dataTableFeatures } from "@/components/table/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toPageSize } from "@/lib/table-search-params"
import type { AuditLog } from "./audit-api"
import { auditLogsQueryOptions } from "./audit-api"
import { AuditDetails } from "./audit-details"
import {
  actionLabel,
  actorLabel,
  eventSummary,
  humanize,
  targetLabel,
} from "./audit-display"
import { AuditEmpty } from "./audit-empty"
import { AuditFilters } from "./audit-filters"
import type { AuditSearch } from "./audit-search-params"

const column = createColumnHelper<typeof dataTableFeatures, AuditLog>()

function auditColumns(onView: (event: AuditLog) => void) {
  return column.columns([
    column.accessor("createdAt", {
      header: "Time",
      cell: ({ getValue }) =>
        new Date(getValue()).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
    }),
    column.accessor((row) => actorLabel(row), {
      id: "actor",
      header: "Actor",
      cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
    }),
    column.accessor("action", {
      header: "Action",
      cell: ({ getValue }) => (
        <Badge
          variant={
            /(FAILED|DELETED|REJECTED)$/.test(getValue())
              ? "destructive"
              : "outline"
          }
        >
          {actionLabel(getValue())}
        </Badge>
      ),
    }),
    column.accessor("resourceType", {
      header: "Resource",
      cell: ({ getValue }) => humanize(getValue()),
    }),
    column.accessor((row) => targetLabel(row), {
      id: "target",
      header: "Target",
    }),
    column.accessor((row) => eventSummary(row), {
      id: "details",
      header: "Details",
      cell: ({ getValue }) => (
        <span className="block max-w-64 truncate" title={getValue()}>
          {getValue()}
        </span>
      ),
    }),
    column.accessor("status", {
      header: "Status",
      cell: ({ getValue }) => (
        <Badge variant={getValue() === "failed" ? "destructive" : "secondary"}>
          {getValue() === "failed" ? "Failed" : "Success"}
        </Badge>
      ),
    }),
    column.display({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onView(row.original)}
          aria-label={`View details for ${row.original.action}`}
        >
          View
        </Button>
      ),
    }),
  ])
}

export function AuditTable() {
  const search = useSearch({ from: "/_main/audit-logs/" })
  const navigate = useNavigate({ from: "/audit-logs/" })
  const [selected, setSelected] = useState<AuditLog | null>(null)
  const query = useQuery(auditLogsQueryOptions(search))
  const columns = useMemo(() => auditColumns(setSelected), [])
  const pagination = useMemo(
    () => ({ pageIndex: search.page - 1, pageSize: search.perPage }),
    [search.page, search.perPage]
  )
  function update(next: Partial<AuditSearch>) {
    void navigate({ search: (previous) => ({ ...previous, ...next, page: 1 }) })
  }
  const table = useTable({
    features: dataTableFeatures,
    data: query.data?.items ?? [],
    columns,
    state: { pagination },
    manualPagination: true,
    rowCount: query.data?.total ?? 0,
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater(pagination) : updater
      void navigate({
        search: (previous) => ({
          ...previous,
          page: next.pageIndex + 1,
          perPage: toPageSize(next.pageSize),
        }),
      })
    },
  })

  return (
    <div className="flex flex-col gap-3">
      <AuditFilters search={search} update={update} />
      {query.isPending ? (
        <p role="status" className="px-4 text-sm lg:px-6">
          Loading audit logs…
        </p>
      ) : query.isError ? (
        <div className="px-4 lg:px-6" role="alert">
          <p className="text-sm text-destructive">{query.error.message}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : query.data.total === 0 ? (
        Object.entries(search).some(
          ([key, value]) => !["page", "perPage", "sort"].includes(key) && value
        ) ? (
          <p className="px-4 text-sm text-muted-foreground lg:px-6">
            No audit logs match these filters.
          </p>
        ) : (
          <AuditEmpty />
        )
      ) : (
        <DataTable
          table={table}
          className="[&_[data-slot=table-cell]]:px-3! [&_[data-slot=table-head]]:px-3!"
        />
      )}
      <AuditDetails event={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
