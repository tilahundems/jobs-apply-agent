import { createFileRoute } from "@tanstack/react-router"
import { PageHeader } from "@/components/page-header"
import { validateAuditSearch } from "@/features/audit/audit-search-params"
import { AuditTable } from "@/features/audit/audit-table"
import { CanView, requirePageAbility } from "@/features/authz"

export const Route = createFileRoute("/_main/audit-logs/")({
  validateSearch: validateAuditSearch,
  beforeLoad: ({ context }) => {
    requirePageAbility(context.rules, "read", "AuditLog")
  },
  component: AuditLogsPage,
})

function AuditLogsPage() {
  return (
    <CanView a="AuditLog">
      <div className="flex flex-col gap-4 pt-2 pb-4 lg:pt-3 lg:pb-6">
        <PageHeader
          title="Audit Logs"
          subtitle="Review recorded changes and access events."
        />
        <AuditTable />
      </div>
    </CanView>
  )
}
