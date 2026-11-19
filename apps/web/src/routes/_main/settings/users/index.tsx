import { createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/page-header"
import { RouteError } from "@/components/route-error"
import { CanView, requirePageAbility } from "@/features/authz"
import {
  rolesQueryOptions,
  UsersTable,
  usersQueryOptions,
} from "@/features/users"
import { userTableSearch } from "@/features/users/users-table-columns"

export const Route = createFileRoute("/_main/settings/users/")({
  validateSearch: userTableSearch.validateSearch,
  beforeLoad: ({ context }) => {
    requirePageAbility(context.rules, "read", "User")
  },
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(usersQueryOptions),
      context.queryClient.ensureQueryData(rolesQueryOptions),
    ]),
  errorComponent: RouteError,
  component: UsersPage,
})

function UsersPage() {
  return (
    <CanView a="User">
      <div className="flex flex-col gap-4 pt-2 pb-4 lg:pt-3 lg:pb-6">
        <PageHeader
          title="Users"
          subtitle="Manage workspace members and their assigned roles."
        />
        <UsersTable />
      </div>
    </CanView>
  )
}
