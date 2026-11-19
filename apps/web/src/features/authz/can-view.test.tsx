import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { AppAbilityRule } from "@/features/authz"
import { AppAbilityProvider } from "@/features/authz"

import { CanView } from "./can-view"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

function renderCanView(rules: AppAbilityRule[]) {
  return render(
    <AppAbilityProvider rules={rules} userId="user-1">
      <CanView a="Project">
        <p>Projects page</p>
      </CanView>
    </AppAbilityProvider>
  )
}

afterEach(cleanup)

describe("CanView", () => {
  it("renders the page when the user can read the subject", () => {
    renderCanView([{ action: "read", subject: "Project" }])

    expect(screen.getByText("Projects page")).toBeTruthy()
    expect(screen.queryByText("You don't have access")).toBeNull()
  })

  it("renders the forbidden view when the user cannot read the subject", () => {
    renderCanView([{ action: "read", subject: "Task" }])

    expect(screen.queryByText("Projects page")).toBeNull()
    expect(screen.getByText("You don't have access")).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: "Back To Dashboard" })
        .getAttribute("href")
    ).toBe("/dashboard")
  })
})
