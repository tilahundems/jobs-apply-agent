import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { AppAbilityProvider } from "@/features/authz"
import { RolesForm } from "./roles-form"

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    isPending: false,
    isError: false,
    data: [
      {
        id: "permission-1",
        subject: "Project",
        action: "read",
        conditions: null,
        fields: [],
        inverted: false,
      },
    ],
    refetch: vi.fn(),
  }),
  useMutation: () => ({
    mutateAsync: vi.fn(),
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}))

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("./roles-api", () => ({
  createRole: vi.fn(),
  updateRole: vi.fn(),
  workspaceRolesQueryOptions: { queryKey: ["workspace-roles"] },
}))

vi.mock("@/features/permissions/permissions-api", () => ({
  permissionsQueryOptions: { queryKey: ["permissions"] },
}))

vi.mock("@/features/users", () => ({
  rolesQueryOptions: { queryKey: ["roles"] },
  usersQueryOptions: { queryKey: ["users"] },
}))

afterEach(cleanup)

function renderForm() {
  return render(
    <AppAbilityProvider
      rules={[{ action: "manage", subject: "all" }]}
      userId="user-1"
    >
      <RolesForm open onOpenChange={() => undefined} showTrigger={false} />
    </AppAbilityProvider>
  )
}

describe("RolesForm", () => {
  it("keeps permissions on the second step until details are valid", async () => {
    renderForm()

    expect(screen.getByRole("heading", { name: "Add Role" })).toBeTruthy()
    expect(screen.getByLabelText("Name")).toBeTruthy()
    expect(screen.queryByLabelText("Search available permissions")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    expect(await screen.findByText("Name is required.")).toBeTruthy()
    expect(screen.queryByLabelText("Search available permissions")).toBeNull()

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Project manager" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    expect(
      await screen.findByLabelText("Search available permissions")
    ).toBeTruthy()
    expect(screen.getByRole("checkbox", { name: "read" })).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Back" }))

    expect(screen.getByLabelText("Name")).toBeTruthy()
    expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe(
      "Project manager"
    )
  })
})
