import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  BellIcon,
  BriefcaseIcon,
  ClipboardListIcon,
  FolderIcon,
  LayoutDashboardIcon,
  ListTodoIcon,
  SearchIcon,
  ShieldKeyholeIcon,
  TagIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react"
import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { useAppAbility } from "@/features/authz"
import { useI18n } from "@/features/i18n/i18n-provider"
import { listProjects } from "@/features/projects/projects-api"
import { workspaceRolesQueryOptions } from "@/features/roles/roles-api"
import { tagsQueryOptions } from "@/features/tags/tags-api"
import { tasksQueryOptions } from "@/features/tasks/tasks-api"
import { usersQueryOptions } from "@/features/users/users-api"

const pages = [
  { title: "Console", to: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Notifications", to: "/notifications", icon: BellIcon },
  { title: "Matches", to: "/jobs", icon: BriefcaseIcon, subject: "JobPost" },
  {
    title: "Profile",
    to: "/profile",
    icon: UserRoundIcon,
    subject: "CandidateProfile",
  },
  { title: "Projects", to: "/projects", icon: FolderIcon, subject: "Project" },
  { title: "Tasks", to: "/tasks", icon: ListTodoIcon, subject: "Task" },
  { title: "Tags", to: "/tags", icon: TagIcon, subject: "Tag" },
  { title: "Users", to: "/settings/users", icon: UsersIcon, subject: "User" },
  {
    title: "Roles & Permissions",
    to: "/settings/roles",
    icon: ShieldKeyholeIcon,
    subject: "Role",
  },
  {
    title: "Audit Logs",
    to: "/audit-logs",
    icon: ClipboardListIcon,
    subject: "AuditLog",
  },
] as const

export function GlobalSearch() {
  const { t } = useI18n()
  const ability = useAppAbility()
  const navigate = useNavigate()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const term = query.trim().toLocaleLowerCase()
  const hasTerm = term.length >= 2
  const [projectTerm, setProjectTerm] = React.useState("")
  const canRead = (
    subject:
      | "Project"
      | "Task"
      | "Tag"
      | "User"
      | "Role"
      | "JobPost"
      | "CandidateProfile"
  ) => ability.can("read", subject)

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  React.useEffect(() => {
    const timer = window.setTimeout(() => setProjectTerm(term), 250)
    return () => window.clearTimeout(timer)
  }, [term])

  const projects = useQuery({
    queryKey: ["global-search", "projects", projectTerm],
    queryFn: () => listProjects({ page: 1, perPage: 20, search: projectTerm }),
    enabled: open && projectTerm.length >= 2 && canRead("Project"),
    staleTime: 30_000,
  })
  const tasks = useQuery({
    ...tasksQueryOptions,
    enabled: open && hasTerm && canRead("Task"),
  })
  const tags = useQuery({
    ...tagsQueryOptions,
    enabled: open && hasTerm && canRead("Tag"),
  })
  const users = useQuery({
    ...usersQueryOptions,
    enabled: open && hasTerm && canRead("User"),
  })
  const roles = useQuery({
    ...workspaceRolesQueryOptions,
    enabled: open && hasTerm && canRead("Role"),
  })

  const visiblePages = pages.filter(
    (page) =>
      (!("subject" in page) || ability.can("read", page.subject)) &&
      (!term ||
        t(page.title).toLocaleLowerCase().includes(term) ||
        page.title.toLocaleLowerCase().includes(term))
  )
  const matchingTasks =
    hasTerm && canRead("Task")
      ? (tasks.data ?? [])
          .filter((task) => task.title.toLocaleLowerCase().includes(term))
          .slice(0, 10)
      : []
  const matchingTags =
    hasTerm && canRead("Tag")
      ? (tags.data ?? [])
          .filter((tag) => tag.label.toLocaleLowerCase().includes(term))
          .slice(0, 10)
      : []
  const matchingUsers =
    hasTerm && canRead("User")
      ? (users.data ?? [])
          .filter((user) =>
            `${user.name} ${user.email}`.toLocaleLowerCase().includes(term)
          )
          .slice(0, 10)
      : []
  const matchingRoles =
    hasTerm && canRead("Role")
      ? (roles.data ?? [])
          .filter((role) => role.name.toLocaleLowerCase().includes(term))
          .slice(0, 10)
      : []
  const matchingProjects =
    hasTerm && canRead("Project") && projectTerm === term
      ? (projects.data?.items ?? [])
      : []
  const hasRecords =
    matchingProjects.length +
      matchingTasks.length +
      matchingTags.length +
      matchingUsers.length +
      matchingRoles.length >
    0
  const pending =
    hasTerm &&
    ((canRead("Project") && projectTerm !== term) ||
      [projects, tasks, tags, users, roles].some((result) => result.isFetching))

  function select(action: () => void) {
    setOpen(false)
    setQuery("")
    action()
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("Search")}
        onClick={() => setOpen(true)}
      >
        <SearchIcon aria-hidden="true" />
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setQuery("")
        }}
        title={t("Search")}
        description={t("Search pages and records")}
      >
        <CommandInput
          aria-label={t("Search pages and records")}
          placeholder={t("Search pages and records…")}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {pending ? t("Searching…") : t("No results found.")}
          </CommandEmpty>
          {visiblePages.length > 0 && (
            <CommandGroup heading={t("Pages")}>
              {visiblePages.map((page) => (
                <CommandItem
                  key={page.to}
                  value={`page ${page.title}`}
                  onSelect={() => select(() => navigate({ to: page.to }))}
                >
                  <page.icon aria-hidden="true" />
                  {t(page.title)}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {hasTerm && (
            <>
              {visiblePages.length > 0 && hasRecords && <CommandSeparator />}
              {matchingProjects.length > 0 && (
                <CommandGroup heading={t("Projects")}>
                  {matchingProjects.map((project) => (
                    <CommandItem
                      key={project.id}
                      value={`project ${project.name} ${project.id}`}
                      onSelect={() =>
                        select(() =>
                          navigate({
                            to: "/projects/$projectId",
                            params: { projectId: project.id },
                          })
                        )
                      }
                    >
                      <FolderIcon aria-hidden="true" />
                      <span className="truncate">{project.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {matchingTasks.length > 0 && (
                <CommandGroup heading={t("Tasks")}>
                  {matchingTasks.map((task) => (
                    <CommandItem
                      key={task.id}
                      value={`task ${task.title} ${task.id}`}
                      onSelect={() =>
                        select(() =>
                          navigate({
                            to: "/tasks/$taskId",
                            params: { taskId: task.id },
                          })
                        )
                      }
                    >
                      <ListTodoIcon aria-hidden="true" />
                      <span className="truncate">{task.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {matchingTags.length > 0 && (
                <CommandGroup heading={t("Tags")}>
                  {matchingTags.map((tag) => (
                    <CommandItem
                      key={tag.id}
                      value={`tag ${tag.label} ${tag.id}`}
                      onSelect={() =>
                        select(() =>
                          navigate({ to: "/tags", search: { q: tag.label } })
                        )
                      }
                    >
                      <TagIcon aria-hidden="true" />
                      <span className="truncate">{tag.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {matchingUsers.length > 0 && (
                <CommandGroup heading={t("Users")}>
                  {matchingUsers.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={`user ${user.name} ${user.email}`}
                      onSelect={() =>
                        select(() =>
                          navigate({
                            to: "/settings/users",
                            search: { q: user.name },
                          })
                        )
                      }
                    >
                      <UsersIcon aria-hidden="true" />
                      <span className="truncate">{user.name}</span>
                      <span className="ml-auto truncate text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {matchingRoles.length > 0 && (
                <CommandGroup heading={t("Roles")}>
                  {matchingRoles.map((role) => (
                    <CommandItem
                      key={role.id}
                      value={`role ${role.name} ${role.key}`}
                      onSelect={() =>
                        select(() =>
                          navigate({
                            to: "/settings/roles",
                            search: { q: role.name },
                          })
                        )
                      }
                    >
                      <ShieldKeyholeIcon aria-hidden="true" />
                      <span className="truncate">{role.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
        <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
          <span>{t("Use ↑↓ to navigate and Enter to open")}</span>
          <span>Esc</span>
        </div>
      </CommandDialog>
    </>
  )
}
