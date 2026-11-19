import { Link, useMatchRoute, useNavigate } from "@tanstack/react-router"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useI18n } from "@/features/i18n/i18n-provider"

export function RolesSettingsTabs() {
  const { t } = useI18n()
  const matchRoute = useMatchRoute()
  const navigate = useNavigate()
  const tab = matchRoute({ to: "/settings/roles/permissions" })
    ? "permissions"
    : "roles"

  return (
    <Tabs
      value={tab}
      className="gap-0"
      onValueChange={(value) => {
        void navigate({
          to:
            value === "permissions"
              ? "/settings/roles/permissions"
              : "/settings/roles",
        })
      }}
    >
      <TabsList variant="line" className="mx-4 lg:mx-6">
        <TabsTrigger
          value="roles"
          nativeButton={false}
          render={<Link to="/settings/roles" />}
        >
          {t("Roles")}
        </TabsTrigger>
        <TabsTrigger
          value="permissions"
          nativeButton={false}
          render={<Link to="/settings/roles/permissions" />}
        >
          {t("Permissions")}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
