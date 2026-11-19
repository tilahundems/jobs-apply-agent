import { useQueryErrorResetBoundary } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { useI18n } from "@/features/i18n/i18n-provider"

export function RouteError({ error }: { error: Error }) {
  const router = useRouter()
  const queryErrorResetBoundary = useQueryErrorResetBoundary()
  const { t } = useI18n()

  useEffect(() => {
    queryErrorResetBoundary.reset()
  }, [queryErrorResetBoundary])

  return (
    <div className="px-4 py-6 lg:px-6">
      <p className="text-sm text-destructive">
        {error.message || t("Unable to load this page")}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() => void router.invalidate()}
      >
        {t("Retry")}
      </Button>
    </div>
  )
}
