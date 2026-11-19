import { Link } from "@tanstack/react-router"
import {
  BriefcaseIcon,
  Building2Icon,
  ClipboardListIcon,
  FolderIcon,
  LayoutDashboardIcon,
  ListTodoIcon,
  ShieldKeyholeIcon,
  TagIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react"
import type * as React from "react"
import symbolLogo from "@/assets/ethio-telecom-symbol.svg"
import { BrandLogo } from "@/components/brand-logo"
import { NavMain } from "@/components/layout/nav-main"
import { NavSecondary } from "@/components/layout/nav-secondary"
import { NavUser } from "@/components/layout/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useI18n } from "@/features/i18n/i18n-provider"

const data = {
  navMain: [
    {
      title: "Console",
      url: "/dashboard",
      icon: <LayoutDashboardIcon />,
    },
    {
      title: "Matches",
      url: "/jobs",
      icon: <BriefcaseIcon />,
      action: "read",
      subject: "JobPost",
    },
    {
      title: "Profile",
      url: "/profile",
      icon: <UserRoundIcon />,
      action: "read",
      subject: "CandidateProfile",
    },
    {
      title: "Projects",
      url: "/projects",
      icon: <FolderIcon />,
      action: "read",
      subject: "Project",
    },
    {
      title: "Tasks",
      url: "/tasks",
      icon: <ListTodoIcon />,
      action: "read",
      subject: "Task",
    },
    {
      title: "Tags",
      url: "/tags",
      icon: <TagIcon />,
      action: "read",
      subject: "Tag",
    },
  ] satisfies React.ComponentProps<typeof NavMain>["items"],
  navSecondary: [
    {
      title: "Users",
      url: "/settings/users",
      icon: <UsersIcon />,
      action: "read",
      subject: "User",
    },
    {
      title: "Organizations",
      url: "/settings/organizations",
      icon: <Building2Icon />,
    },
    {
      title: "Roles & Permissions",
      url: "/settings/roles",
      icon: <ShieldKeyholeIcon />,
      action: "read",
      subject: "Role",
    },
    {
      title: "Audit Logs",
      url: "/audit-logs",
      icon: <ClipboardListIcon />,
      action: "read",
      subject: "AuditLog",
    },
  ] satisfies React.ComponentProps<typeof NavSecondary>["items"],
}

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: {
    name: string
    email: string
    image?: string | null
  }
}) {
  const { t } = useI18n()
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="p-0! text-sidebar-foreground"
              render={<Link to="/dashboard" />}
            >
              <span className="group-data-[collapsible=icon]:hidden">
                <BrandLogo className="w-[150px] shrink-0" />
              </span>
              <img
                src={symbolLogo}
                alt="Ethio telecom"
                className="hidden size-8 object-contain group-data-[collapsible=icon]:block"
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={data.navMain.map((item) => ({
            ...item,
            title: t(item.title),
          }))}
        />
        <NavSecondary
          items={data.navSecondary
            .filter(
              (item) =>
                item.url !== "/settings/organizations" ||
                import.meta.env.VITE_MULTI_TENANCY === "true"
            )
            .map((item) => ({
              ...item,
              title: t(item.title),
            }))}
          label={t("Settings")}
          className="mt-auto"
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
