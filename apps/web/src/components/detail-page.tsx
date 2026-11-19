import type { LucideIcon } from "lucide-react"
import { EllipsisIcon, LinkIcon, SquarePenIcon, Trash2Icon } from "lucide-react"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import type { Subject } from "@/features/authz"
import { Can } from "@/features/authz"

export function DetailActions({
  kind,
  subject,
  onEdit,
  onDelete,
  children,
}: {
  kind: string
  subject: Extract<Subject, "Project" | "Task">
  onEdit: () => void
  onDelete: () => void
  children?: ReactNode
}) {
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success("Link copied")
    } catch {
      toast.error("Unable to copy link. Copy the URL from your address bar.")
    }
  }

  return (
    <>
      <Can I="update" a={subject}>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <SquarePenIcon data-icon="inline-start" />
          Edit {kind}
        </Button>
      </Can>
      {children}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`More ${kind} Actions`}
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => void copyLink()}>
              <LinkIcon />
              Copy Link
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <Can I="delete" a={subject}>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2Icon />
                Delete {kind}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </Can>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

export function DetailEmpty({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <Empty className="rounded-lg border border-dashed py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  )
}

export function DetailPagePending() {
  return (
    <div
      role="status"
      className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 lg:px-6"
    >
      <span className="sr-only">Loading details</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-7 w-3/4" />
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-40 w-full max-w-3xl" />
    </div>
  )
}

export function DetailError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div
      role="alert"
      className="mx-auto flex w-full max-w-5xl flex-col items-start gap-3 px-4 py-8 lg:px-6"
    >
      <h1 className="font-heading text-xl font-semibold">
        Unable to load details
      </h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" onClick={onRetry}>
        Try Again
      </Button>
    </div>
  )
}
