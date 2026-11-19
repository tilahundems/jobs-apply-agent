import { Link, useMatchRoute } from "@tanstack/react-router"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { Action, PageSubject } from "@/features/authz"
import { Can } from "@/features/authz"

type NavMainItem = {
  title: string
  url: "/dashboard" | "/jobs" | "/profile" | "/projects" | "/tasks" | "/tags"
  icon?: React.ReactNode
  action?: Action
  subject?: PageSubject
}

function NavMainLink({
  item,
  isActive,
}: {
  item: NavMainItem
  isActive: boolean
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={item.title}
        isActive={isActive}
        render={<Link to={item.url} />}
      >
        {item.icon}
        <span>{item.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function NavMain({ items }: { items: NavMainItem[] }) {
  const matchRoute = useMatchRoute()

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = Boolean(matchRoute({ to: item.url, fuzzy: true }))
            const link = <NavMainLink item={item} isActive={isActive} />

            if (item.subject == null) {
              return (
                <NavMainLink key={item.title} item={item} isActive={isActive} />
              )
            }

            return (
              <Can key={item.title} I={item.action ?? "read"} a={item.subject}>
                {link}
              </Can>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
