import type { ReactNode } from "react"
import { useI18n } from "@/features/i18n/i18n-provider"
import { cn } from "@/lib/utils"

/** In-page title and subtitle for list and overview routes under the app shell. */
export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string
  subtitle: ReactNode
  actions?: ReactNode
  className?: string
}) {
  const { t } = useI18n()
  return (
    <header
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 px-4 lg:px-6",
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="font-heading text-xl leading-tight font-semibold tracking-tight">
          {t(title)}
        </h1>
        {subtitle ? (
          <p className="max-w-3xl text-sm text-muted-foreground">
            {typeof subtitle === "string" ? t(subtitle) : subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  )
}
