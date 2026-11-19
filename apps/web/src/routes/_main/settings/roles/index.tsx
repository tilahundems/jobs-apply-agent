import { createFileRoute } from "@tanstack/react-router"

import { RouteError } from "@/components/route-error"
import { RolesTable, workspaceRolesQueryOptions } from "@/features/roles"
import { roleTableSearch } from "@/features/roles/roles-table-columns"

export const Route = createFileRoute("/_main/settings/roles/")({
  validateSearch: roleTableSearch.validateSearch,
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(workspaceRolesQueryOptions),
  errorComponent: RouteError,
  component: RolesPage,
})

function RolesPage() {
  return <RolesTable />
}
