import { createFileRoute, Outlet } from "@tanstack/react-router"

import { PageHeader } from "@/components/page-header"
import { CanView, requirePageAbility } from "@/features/authz"
import { RolesSettingsTabs } from "@/features/roles/roles-settings-tabs"

export const Route = createFileRoute("/_main/settings/roles")({
  beforeLoad: ({ context }) => {
    requirePageAbility(context.rules, "read", "Role")
  },
  component: RolesLayout,
})

function RolesLayout() {
  return (
    <CanView a="Role">
      <div className="flex flex-1 flex-col gap-4 pt-2 pb-4 lg:pt-3 lg:pb-6">
        <PageHeader
          title="Roles & Permissions"
          subtitle="Define roles and the permissions they grant."
        />
        <RolesSettingsTabs />
        <Outlet />
      </div>
    </CanView>
  )
}
