import { useQueryClient } from "@tanstack/react-query"
import { Link, useRouter, useRouterState } from "@tanstack/react-router"
import {
  BriefcaseIcon,
  FolderIcon,
  LayoutDashboardIcon,
  ListTodoIcon,
  LockIcon,
  LogOutIcon,
  MoonIcon,
  RefreshCwIcon,
  SettingsIcon,
  SunIcon,
  TagIcon,
  UserRoundIcon,
} from "lucide-react"
import { toast } from "sonner"
import { useTheme } from "@/components/theme-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/features/auth/auth-client"
import { navigateAfterSessionChange } from "@/features/auth/session-cache"
import { useScanChannels } from "@/features/jobs/use-scan"
import { cn } from "@/lib/utils"

const NAV = [
  {
    to: "/dashboard",
    label: "Console",
    icon: LayoutDashboardIcon,
    exact: true,
  },
  { to: "/jobs", label: "Matches", icon: BriefcaseIcon, exact: false },
  { to: "/profile", label: "Profile", icon: UserRoundIcon, exact: true },
] as const

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : ""
  return (first + last).toUpperCase() || "U"
}

/**
 * The product shell: the agent is a workspace, not an admin panel, so the
 * screens get the whole window and navigation is a short top rail.
 */
export function AgentShell({
  user,
  children,
}: {
  user: { name: string; email: string; image?: string | null }
  children: React.ReactNode
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4 sm:px-6">
          <nav className="flex items-center gap-0.5 text-sm">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.to || pathname === `${item.to}/`
                : pathname === item.to || pathname.startsWith(`${item.to}/`)
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-label={item.label}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground",
                    active && "bg-muted text-foreground"
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <ScanButton />
            <UserMenu user={user} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-20 sm:px-6">
        {children}
      </main>

      <footer className="border-t border-border/60 py-4">
        <p className="mx-auto max-w-5xl px-4 text-xs text-muted-foreground sm:px-6">
          The agent scans, scores and writes. It never applies for you.
        </p>
      </footer>
    </div>
  )
}

function ScanButton() {
  const scan = useScanChannels()

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => scan.mutate()}
      disabled={scan.isPending}
      className="text-muted-foreground"
    >
      <RefreshCwIcon className={cn(scan.isPending && "animate-spin")} />
      <span className="hidden sm:inline">
        {scan.isPending ? "Scanning…" : "Scan channels"}
      </span>
    </Button>
  )
}

function UserMenu({
  user,
}: {
  user: { name: string; email: string; image?: string | null }
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { theme, setTheme } = useTheme()
  const dark = theme === "dark"

  async function signOut() {
    const { error } = await authClient.signOut()
    if (error) {
      toast.error(error.message ?? "Unable to sign out")
      return
    }
    await navigateAfterSessionChange(queryClient, router, "/login")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button size="icon-sm" variant="ghost" aria-label="Account" />}
      >
        <Avatar className="size-7">
          {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
          <AvatarFallback className="text-[11px]">
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>{" "}
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate text-sm font-medium">
              {user.name}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {user.email}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setTheme(dark ? "light" : "dark")}>
            {dark ? <SunIcon /> : <MoonIcon />}
            {dark ? "Light theme" : "Dark theme"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link to="/profile" />}>
            <LockIcon />
            What the agent knows
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link to="/settings/users" />}>
            <SettingsIcon />
            Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link to="/projects" />}>
            <FolderIcon />
            Projects
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link to="/tasks" />}>
            <ListTodoIcon />
            Tasks
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link to="/tags" />}>
            <TagIcon />
            Tags
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => void signOut()}
          >
            <LogOutIcon />
            Log out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
