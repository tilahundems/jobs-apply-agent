import { useQuery } from "@tanstack/react-query"
import { Link, useMatchRoute } from "@tanstack/react-router"
import { GlobalSearch } from "@/components/layout/global-search"

import { ThemeToggle } from "@/components/layout/theme-toggle"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useAppAbility } from "@/features/authz"
import { useI18n } from "@/features/i18n/i18n-provider"
import { jobQueryOptions } from "@/features/jobs/jobs-api"
import { NotificationBell } from "@/features/notifications/notification-bell"
import { projectQueryOptions } from "@/features/projects/projects-api"
import { tasksQueryOptions } from "@/features/tasks/tasks-api"

const pageTitles = [
  { to: "/dashboard", title: "Console" },
  { to: "/jobs", title: "Matches" },
  { to: "/profile", title: "Profile" },
  { to: "/projects", title: "Projects" },
  { to: "/tasks", title: "Tasks" },
  { to: "/tags", title: "Tags" },
  { to: "/settings/users", title: "Users" },
  { to: "/settings/organizations", title: "Organizations" },
  { to: "/settings/roles", title: "Roles & Permissions" },
  { to: "/audit-logs", title: "Audit Logs" },
  { to: "/notifications", title: "Notifications" },
] as const

export function SiteHeader() {
  const { t } = useI18n()
  const matchRoute = useMatchRoute()
  const ability = useAppAbility()
  const projectMatch = matchRoute({ to: "/projects/$projectId" })
  const taskMatch = matchRoute({ to: "/tasks/$taskId" })
  const jobMatch = matchRoute({ to: "/jobs/$jobId" })
  const projectId = projectMatch ? projectMatch.projectId : ""
  const taskId = taskMatch ? taskMatch.taskId : ""
  const jobId = jobMatch ? jobMatch.jobId : ""
  const { data: job } = useQuery({
    ...jobQueryOptions(jobId),
    enabled: Boolean(jobId) && ability.can("read", "JobPost"),
  })
  const { data: project } = useQuery({
    ...projectQueryOptions(projectId),
    enabled: Boolean(projectId) && ability.can("read", "Project"),
  })
  const { data: tasks } = useQuery({
    ...tasksQueryOptions,
    enabled: Boolean(taskId) && ability.can("read", "Task"),
  })
  const title =
    pageTitles.find((page) => matchRoute({ to: page.to, fuzzy: true }))
      ?.title ?? "Ethio telecom"
  const detailTitle = projectId
    ? (project?.name ?? t("Project"))
    : taskId
      ? (tasks?.find((task) => task.id === taskId)?.title ?? t("Task"))
      : jobId
        ? (job?.title ?? t("Job"))
        : null
  const parentPath = projectId ? "/projects" : taskId ? "/tasks" : "/jobs"

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        {detailTitle ? (
          <Breadcrumb className="min-w-0">
            <BreadcrumbList className="flex-nowrap text-base font-medium">
              <BreadcrumbItem className="shrink-0">
                <BreadcrumbLink render={<Link to={parentPath} />}>
                  {t(title)}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="block truncate" title={detailTitle}>
                  {detailTitle}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        ) : (
          <p className="text-base font-medium">{t(title)}</p>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <GlobalSearch />
          <NotificationBell />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
