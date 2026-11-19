import {
  createFileRoute,
  Outlet,
  redirect,
  useMatchRoute,
  useRouterState,
} from "@tanstack/react-router"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AgentShell } from "@/features/agent"
import { getSession } from "@/features/auth"
import { setSessionScope } from "@/features/auth/session-cache"
import { AppAbilityProvider, getAbilityRules } from "@/features/authz"
import { useI18n } from "@/features/i18n/i18n-provider"

export const Route = createFileRoute("/_main")({
  beforeLoad: async ({ context }) => {
    const session = await getSession()

    if (!session) {
      throw redirect({ to: "/login" })
    }

    const organizationId =
      "activeOrganizationId" in session.session
        ? (session.session.activeOrganizationId as string | null | undefined)
        : null
    const rules =
      import.meta.env.VITE_MULTI_TENANCY === "true" && !organizationId
        ? []
        : await getAbilityRules()
    await setSessionScope(
      context.queryClient,
      session.user.id,
      rules,
      organizationId
    )
    return { session, rules }
  },
  component: MainLayout,
})

/** The agent screens get their own chrome; the rest of the app is the kit's. */
const AGENT_PATHS = ["/dashboard", "/jobs", "/profile"]

function MainLayout() {
  const { t } = useI18n()
  const { session, rules } = Route.useRouteContext()
  const matchRoute = useMatchRoute()
  const isOrganizationsPage = Boolean(
    matchRoute({ to: "/settings/organizations" })
  )
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const isAgentArea = AGENT_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )

  const body =
    import.meta.env.VITE_MULTI_TENANCY === "true" &&
    !isOrganizationsPage &&
    !(
      "activeOrganizationId" in session.session &&
      session.session.activeOrganizationId
    ) ? (
      <section className="mx-auto max-w-xl p-8">
        <h1 className="text-2xl font-semibold">Choose an organization</h1>
        <p className="mt-2 text-muted-foreground">
          Open Organizations in Settings to create or select one.
        </p>
      </section>
    ) : rules.length === 0 && !isOrganizationsPage ? (
      <section className="mx-auto max-w-xl p-8">
        <h1 className="text-2xl font-semibold">{t("Access pending")}</h1>
        <p className="mt-2 text-muted-foreground">
          {t(
            "Your account has no role yet. Ask an administrator to assign one."
          )}
        </p>
      </section>
    ) : (
      <Outlet />
    )

  if (isAgentArea) {
    return (
      <AppAbilityProvider rules={rules} userId={session.user.id}>
        <AgentShell user={session.user}>{body}</AgentShell>
      </AppAbilityProvider>
    )
  }

  return (
    <AppAbilityProvider rules={rules} userId={session.user.id}>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 64)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar user={session.user} variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              {body}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AppAbilityProvider>
  )
}
