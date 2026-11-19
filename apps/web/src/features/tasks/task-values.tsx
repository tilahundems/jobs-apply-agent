import {
  CheckCircle2Icon,
  CircleDashedIcon,
  CircleDotIcon,
  FlagIcon,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useI18n } from "@/features/i18n/i18n-provider"
import { initials } from "@/lib/format"
import type { Task, TaskPriority, TaskStatus } from "./tasks-api"
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "./tasks-api"

export const TASK_STATUS_ICONS = {
  todo: CircleDashedIcon,
  in_progress: CircleDotIcon,
  done: CheckCircle2Icon,
}

export const TASK_STATUS_ICON_CLASS: Record<TaskStatus, string> = {
  todo: "text-muted-foreground!",
  in_progress: "text-sky-600! dark:text-sky-400!",
  done: "text-emerald-600! dark:text-emerald-400!",
}

export const TASK_PRIORITY_ICON_CLASS: Record<TaskPriority, string> = {
  low: "text-muted-foreground!",
  medium: "text-amber-500! dark:text-amber-400!",
  high: "text-red-600! dark:text-red-400!",
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { t } = useI18n()
  const Icon = TASK_STATUS_ICONS[status]
  return (
    <Badge variant="outline">
      <Icon
        data-icon="inline-start"
        className={TASK_STATUS_ICON_CLASS[status]}
      />
      {t(TASK_STATUS_LABELS[status])}
    </Badge>
  )
}

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  const { t } = useI18n()
  return (
    <Badge variant="outline">
      <FlagIcon
        data-icon="inline-start"
        className={TASK_PRIORITY_ICON_CLASS[priority]}
      />
      {t(TASK_PRIORITY_LABELS[priority])}
    </Badge>
  )
}

export function TaskAssignee({ assignee }: { assignee: Task["assignee"] }) {
  const { t } = useI18n()
  if (!assignee)
    return <span className="text-muted-foreground">{t("Unassigned")}</span>
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar size="sm">
        {assignee.image ? <AvatarImage src={assignee.image} alt="" /> : null}
        <AvatarFallback>{initials(assignee.name)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 break-words">{assignee.name}</span>
    </span>
  )
}
