import { Link, useMatchRoute } from "@tanstack/react-router"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { Action, PageSubject } from "@/features/authz"
import { Can, useAppAbility } from "@/features/authz"

type NavSecondaryItem = {
  title: string
  url:
    | "/settings/users"
    | "/settings/organizations"
    | "/settings/roles"
    | "/audit-logs"
  icon?: React.ReactNode
  action?: Action
  subject?: PageSubject
}

function NavSecondaryLink({
  item,
  isActive,
}: {
  item: NavSecondaryItem
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

export function NavSecondary({
  items,
  label,
  ...props
}: {
  items: NavSecondaryItem[]
  label: string
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const matchRoute = useMatchRoute()
  const ability = useAppAbility()
  const visibleItems = items.filter(
    (item) =>
      item.subject == null || ability.can(item.action ?? "read", item.subject)
  )

  if (visibleItems.length === 0) {
    return null
  }

  return (
    <SidebarGroup {...props}>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {visibleItems.map((item) => {
            const isActive = Boolean(matchRoute({ to: item.url, fuzzy: true }))
            const link = <NavSecondaryLink item={item} isActive={isActive} />

            if (item.subject == null) {
              return (
                <NavSecondaryLink
                  key={item.title}
                  item={item}
                  isActive={isActive}
                />
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
