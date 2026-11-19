import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import {
  BellIcon,
  EllipsisVerticalIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  SunIcon,
} from "lucide-react"
import { toast } from "sonner"
import { useTheme } from "@/components/theme-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { authClient } from "@/features/auth/auth-client"
import { navigateAfterSessionChange } from "@/features/auth/session-cache"
import { useI18n } from "@/features/i18n/i18n-provider"
import { cn } from "@/lib/utils"

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) {
    return "U"
  }

  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : ""
  return (first + last).toUpperCase() || "U"
}

const themeOptions = [
  { value: "light" as const, icon: SunIcon, label: "Light" },
  { value: "dark" as const, icon: MoonIcon, label: "Dark" },
  { value: "system" as const, icon: MonitorIcon, label: "System" },
]

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    image?: string | null
  }
}) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { theme, setTheme } = useTheme()
  const avatarFallback = initials(user.name)
  const { t } = useI18n()

  async function signOut() {
    const { error } = await authClient.signOut()
    if (error) {
      toast.error(error.message ?? t("Unable to sign out"))
      return
    }
    await navigateAfterSessionChange(queryClient, router, "/login")
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="text-sidebar-foreground aria-expanded:bg-muted"
              />
            }
          >
            <Avatar className={cn("size-8", user.image && "grayscale")}>
              {user.image ? (
                <AvatarImage src={user.image} alt={user.name} />
              ) : null}
              <AvatarFallback>{avatarFallback}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-foreground/70">
                {user.email}
              </span>
            </div>
            <EllipsisVerticalIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="size-8">
                    {user.image ? (
                      <AvatarImage src={user.image} alt={user.name} />
                    ) : null}
                    <AvatarFallback>{avatarFallback}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <div className="flex items-center justify-between gap-2 px-1.5 py-1 text-sm">
                <div className="flex items-center gap-1.5 text-foreground">
                  <PaletteIcon className="size-4 shrink-0" />
                  {t("Theme")}
                </div>
                <fieldset
                  aria-label={t("Theme")}
                  className="flex items-center rounded-full bg-muted p-0.5"
                >
                  {themeOptions.map(({ value, icon: Icon, label }) => {
                    const selected = theme === value
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-label={t(label)}
                        aria-pressed={selected}
                        onClick={() => setTheme(value)}
                        className={cn(
                          "flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground",
                          selected && "bg-background text-foreground shadow-sm"
                        )}
                      >
                        <Icon className="size-3.5" />
                      </button>
                    )
                  })}
                </fieldset>
              </div>
              <DropdownMenuItem>
                <BellIcon />
                {t("Notifications")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => void signOut()}
            >
              <LogOutIcon />
              {t("Log Out")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
