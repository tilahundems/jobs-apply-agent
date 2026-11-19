import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import type { Subject } from "@/features/authz"
import { Can } from "@/features/authz"
import { useI18n } from "@/features/i18n/i18n-provider"

/**
 * The first-run state of a list. `create` shows a button, for users who may
 * create `subject`, that opens the dialog returned by `form`. Text is translated.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  create,
}: {
  icon: LucideIcon
  title: string
  description: string
  create?: {
    label: string
    subject: Exclude<Subject, "all">
    form: (open: boolean, onOpenChange: (open: boolean) => void) => ReactNode
  }
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-1 flex-col px-4 lg:px-6">
      <Empty className="border border-dashed py-10">
        <EmptyHeader>
          <EmptyMedia
            variant="icon"
            className="size-12 rounded-full text-muted-foreground"
          >
            <Icon className="size-6" />
          </EmptyMedia>
          <EmptyTitle>{t(title)}</EmptyTitle>
          <EmptyDescription>{t(description)}</EmptyDescription>
        </EmptyHeader>
        {create ? (
          <EmptyContent className="flex-row justify-center gap-2">
            <Can I="create" a={create.subject}>
              <Button onClick={() => setOpen(true)}>{t(create.label)}</Button>
            </Can>
          </EmptyContent>
        ) : null}
      </Empty>
      {create?.form(open, setOpen)}
    </div>
  )
}
