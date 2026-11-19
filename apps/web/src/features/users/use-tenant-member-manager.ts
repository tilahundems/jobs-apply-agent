import { useQuery } from "@tanstack/react-query"
import { useRouteContext } from "@tanstack/react-router"
import { authClient } from "@/features/auth/auth-client"

export function useTenantMemberManager() {
  const { session } = useRouteContext({ from: "/_main" })
  const activeId =
    "activeOrganizationId" in session.session
      ? (session.session.activeOrganizationId as string | null)
      : null
  const { data } = useQuery({
    queryKey: ["active-organization-member", activeId],
    enabled: import.meta.env.VITE_MULTI_TENANCY === "true" && !!activeId,
    queryFn: async () => {
      const result = await authClient.organization.getActiveMember()
      if (result.error)
        throw new Error(result.error.message ?? "Unable to load membership")
      return result.data
    },
  })
  return (
    import.meta.env.VITE_MULTI_TENANCY !== "true" ||
    !!data?.role.split(",").some((role) => role === "owner" || role === "admin")
  )
}
