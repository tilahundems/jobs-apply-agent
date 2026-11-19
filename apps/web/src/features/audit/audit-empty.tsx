import { ClipboardListIcon } from "lucide-react"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useI18n } from "@/features/i18n/i18n-provider"

export function AuditEmpty() {
  const { t } = useI18n()

  return (
    <div className="flex flex-1 flex-col px-4 lg:px-6">
      <Empty className="border border-dashed py-10">
        <EmptyHeader>
          <EmptyMedia
            variant="icon"
            className="size-12 rounded-full text-muted-foreground"
          >
            <ClipboardListIcon className="size-6" />
          </EmptyMedia>
          <EmptyTitle>{t("No Audit Logs Yet")}</EmptyTitle>
          <EmptyDescription>
            {t(
              "Recorded changes and access events will show up here once they happen."
            )}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  )
}
