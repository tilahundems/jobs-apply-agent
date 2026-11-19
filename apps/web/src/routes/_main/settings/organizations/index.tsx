import { createFileRoute, redirect } from "@tanstack/react-router"
import { OrganizationsPage } from "@/features/organizations/organizations-page"

export const Route = createFileRoute("/_main/settings/organizations/")({
  beforeLoad: () => {
    if (import.meta.env.VITE_MULTI_TENANCY !== "true") {
      throw redirect({ to: "/dashboard" })
    }
  },
  component: function Organizations() {
    const { session } = Route.useRouteContext()
    const activeId =
      "activeOrganizationId" in session.session
        ? (session.session.activeOrganizationId as string | null)
        : null
    return <OrganizationsPage activeId={activeId} />
  },
})
