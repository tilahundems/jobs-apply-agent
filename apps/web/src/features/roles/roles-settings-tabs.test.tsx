import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { RolesSettingsTabs } from "./roles-settings-tabs"

const state = vi.hoisted(() => ({
  permissionsActive: false,
}))

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useMatchRoute: () => (opts: { to: string }) =>
    state.permissionsActive && opts.to === "/settings/roles/permissions"
      ? {}
      : false,
}))

afterEach(() => {
  state.permissionsActive = false
  cleanup()
})

describe("RolesSettingsTabs", () => {
  it("links the roles sidebar page to both tabs", () => {
    render(<RolesSettingsTabs />)

    expect(
      screen.getByRole("tab", { name: "Roles" }).getAttribute("href")
    ).toBe("/settings/roles")
    expect(
      screen.getByRole("tab", { name: "Permissions" }).getAttribute("href")
    ).toBe("/settings/roles/permissions")
  })
})
