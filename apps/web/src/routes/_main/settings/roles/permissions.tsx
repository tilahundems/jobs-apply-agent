import { createFileRoute } from "@tanstack/react-router"

import { RouteError } from "@/components/route-error"
import { requirePageAbility } from "@/features/authz"
import {
  permissionOptionsQueryOptions,
  permissionsQueryOptions,
} from "@/features/permissions/permissions-api"
import { PermissionsTable } from "@/features/permissions/permissions-table"
import { permissionTableSearch } from "@/features/permissions/permissions-table-columns"

export const Route = createFileRoute("/_main/settings/roles/permissions")({
  validateSearch: permissionTableSearch.validateSearch,
  beforeLoad: ({ context }) =>
    requirePageAbility(context.rules, "read", "Permission"),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(permissionsQueryOptions),
      context.queryClient.ensureQueryData(permissionOptionsQueryOptions),
    ]),
  errorComponent: RouteError,
  component: PermissionsTable,
})
