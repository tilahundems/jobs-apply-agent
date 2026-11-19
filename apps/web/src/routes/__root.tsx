import type { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router"

import { ThemeProvider } from "@/components/theme-provider"
import { I18nProvider, useI18n } from "@/features/i18n/i18n-provider"

function NotFound() {
  const { t } = useI18n()
  return (
    <main className="container mx-auto p-4 pt-16">
      <h1>404</h1>
      <p>{t("The requested page could not be found.")}</p>
    </main>
  )
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  notFoundComponent: NotFound,
  component: Root,
})

function Root() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <Outlet />
      </ThemeProvider>
    </I18nProvider>
  )
}
