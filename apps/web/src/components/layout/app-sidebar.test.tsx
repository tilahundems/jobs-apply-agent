import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SidebarProvider } from "@/components/ui/sidebar"
import type { AppAbilityRule } from "@/features/authz"
import { AppAbilityProvider } from "@/features/authz"

import { AppSidebar } from "./app-sidebar"
import { NavMain } from "./nav-main"
import { NavSecondary } from "./nav-secondary"

vi.mock("./nav-user", () => ({ NavUser: () => null }))

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
})

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useMatchRoute: () => () => false,
}))

const navMain = [
  { title: "Dashboard", url: "/dashboard" as const },
  { title: "Projects", url: "/projects" as const, subject: "Project" as const },
  { title: "Tasks", url: "/tasks" as const, subject: "Task" as const },
  { title: "Tags", url: "/tags" as const, subject: "Tag" as const },
]

const navSecondary = [
  {
    title: "Users",
    url: "/settings/users" as const,
    subject: "User" as const,
  },
  {
    title: "Roles & Permissions",
    url: "/settings/roles" as const,
    subject: "Role" as const,
  },
  {
    title: "Audit Logs",
    url: "/audit-logs" as const,
    subject: "AuditLog" as const,
  },
]

function renderNav(rules: AppAbilityRule[]) {
  return render(
    <AppAbilityProvider rules={rules} userId="user-1">
      <SidebarProvider>
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} label="Settings" />
      </SidebarProvider>
    </AppAbilityProvider>
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe("sidebar abilities", () => {
  it("places Organizations after Users when multi-tenancy is enabled", () => {
    vi.stubEnv("VITE_MULTI_TENANCY", "true")
    render(
      <AppAbilityProvider
        rules={[{ action: "read", subject: "User" }]}
        userId="user-1"
      >
        <SidebarProvider>
          <AppSidebar user={{ name: "Ada", email: "ada@example.test" }} />
        </SidebarProvider>
      </AppAbilityProvider>
    )

    const links = screen.getAllByRole("link")
    expect(
      links.findIndex((link) => link.textContent === "Organizations")
    ).toBe(links.findIndex((link) => link.textContent === "Users") + 1)
    expect(screen.getByRole("link", { name: "Organizations" })).toBeTruthy()
    expect(screen.queryByLabelText("New organization name")).toBeNull()
  })

  it("shows the audit link only with audit read permission", () => {
    const view = render(
      <AppAbilityProvider rules={[]} userId="user-1">
        <SidebarProvider>
          <AppSidebar user={{ name: "Ada", email: "ada@example.test" }} />
        </SidebarProvider>
      </AppAbilityProvider>
    )
    expect(screen.queryByRole("link", { name: "Audit Logs" })).toBeNull()

    view.rerender(
      <AppAbilityProvider
        rules={[{ action: "read", subject: "AuditLog" }]}
        userId="user-1"
      >
        <SidebarProvider>
          <AppSidebar user={{ name: "Ada", email: "ada@example.test" }} />
        </SidebarProvider>
      </AppAbilityProvider>
    )
    expect(screen.getByRole("link", { name: "Audit Logs" })).toBeTruthy()
  })

  it("shows every sidebar item the user can read", () => {
    renderNav([
      { action: "read", subject: "Project" },
      { action: "read", subject: "Task" },
      { action: "read", subject: "Tag" },
      { action: "read", subject: "User" },
      { action: "read", subject: "Role" },
      { action: "read", subject: "AuditLog" },
    ])

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Projects" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Tasks" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Tags" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Users" })).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Roles & Permissions" })
    ).toBeTruthy()
    expect(screen.getByText("Settings")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Audit Logs" })).toBeTruthy()
  })

  it("hides sidebar items and the settings group the user cannot read", () => {
    renderNav([{ action: "read", subject: "Task" }])

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Tasks" })).toBeTruthy()
    expect(screen.queryByRole("link", { name: "Projects" })).toBeNull()
    expect(screen.queryByRole("link", { name: "Tags" })).toBeNull()
    expect(screen.queryByRole("link", { name: "Users" })).toBeNull()
    expect(
      screen.queryByRole("link", { name: "Roles & Permissions" })
    ).toBeNull()
    expect(screen.queryByText("Settings")).toBeNull()
    expect(screen.queryByRole("link", { name: "Audit Logs" })).toBeNull()
  })

  it("shows only projects and tasks for the user role", () => {
    renderNav([
      { action: "read", subject: "Project" },
      { action: "read", subject: "Task" },
      { action: "create", subject: "Task" },
    ])

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Projects" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Tasks" })).toBeTruthy()
    expect(screen.queryByRole("link", { name: "Tags" })).toBeNull()
    expect(screen.queryByRole("link", { name: "Users" })).toBeNull()
    expect(
      screen.queryByRole("link", { name: "Roles & Permissions" })
    ).toBeNull()
    expect(screen.queryByText("Settings")).toBeNull()
  })
})
