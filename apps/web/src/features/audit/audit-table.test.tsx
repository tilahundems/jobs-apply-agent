import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { AuditTable } from "./audit-table"

const state = vi.hoisted(() => ({
  result: {} as Record<string, unknown>,
  search: {
    page: 1,
    perPage: 10,
    q: "",
    actor: "",
    action: "",
    resourceType: "",
    status: "",
    from: "",
    to: "",
    sort: "newest",
  },
  navigate: vi.fn(),
  refetch: vi.fn(),
}))

vi.mock("@tanstack/react-query", async (original) => ({
  ...(await original<object>()),
  useQuery: () => state.result,
}))
vi.mock("@tanstack/react-router", () => ({
  useSearch: () => state.search,
  useNavigate: () => state.navigate,
}))

afterEach(() => {
  cleanup()
  state.navigate.mockClear()
  state.refetch.mockClear()
  state.search.q = ""
})

it("writes search to the URL and distinguishes no results from an empty log", () => {
  state.result = {
    isPending: false,
    isError: false,
    data: { items: [], total: 0 },
  }
  const view = render(<AuditTable />)
  fireEvent.change(screen.getByRole("textbox", { name: "Search audit logs" }), {
    target: { value: "role" },
  })
  expect(state.navigate.mock.calls[0][0].search(state.search)).toMatchObject({
    q: "role",
    page: 1,
  })
  state.search.q = "role"
  view.rerender(<AuditTable />)
  expect(screen.getByText("No audit logs match these filters.")).toBeTruthy()
})

it("applies actor and date filters through the URL", async () => {
  state.result = {
    isPending: false,
    isError: false,
    data: { items: [], total: 0 },
  }
  render(<AuditTable />)
  fireEvent.click(screen.getByRole("button", { name: "Filters" }))
  fireEvent.change(await screen.findByLabelText("Actor name, email, or ID"), {
    target: { value: "Ada" },
  })
  fireEvent.change(screen.getByLabelText("From date"), {
    target: { value: "2026-09-24" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Apply" }))
  expect(state.navigate.mock.calls[0][0].search(state.search)).toMatchObject({
    actor: "Ada",
    from: "2026-09-24",
    page: 1,
  })
})

it("shows loading, empty, and retryable error states", () => {
  state.result = { isPending: true }
  const view = render(<AuditTable />)
  expect(screen.getByRole("status").textContent).toContain("Loading")

  state.result = {
    isPending: false,
    isError: false,
    data: { items: [], total: 0 },
  }
  view.rerender(<AuditTable />)
  expect(screen.getByText("No Audit Logs Yet")).toBeTruthy()

  state.result = {
    isPending: false,
    isError: true,
    error: new Error("History unavailable"),
    refetch: state.refetch,
  }
  view.rerender(<AuditTable />)
  expect(screen.getByRole("alert").textContent).toContain("History unavailable")
  fireEvent.click(screen.getByRole("button", { name: "Retry" }))
  expect(state.refetch).toHaveBeenCalledOnce()
})

it("renders records and moves to the next server page", () => {
  state.result = {
    isPending: false,
    isError: false,
    data: {
      total: 12,
      items: [
        {
          id: "event-1",
          createdAt: "2026-09-25T10:00:00.000Z",
          actorId: "user-1",
          actorType: "USER",
          actorName: "Ada Admin",
          actorEmail: "ada@example.test",
          action: "ROLE_CHANGED",
          resourceType: "role",
          resourceId: "role-1",
          status: "success",
          oldValues: { role: "USER" },
          newValues: { role: "ADMIN" },
          metadata: null,
        },
      ],
    },
  }
  render(<AuditTable />)

  expect(screen.getByText("Ada Admin")).toBeTruthy()
  expect(screen.queryByText("USER")).toBeNull()
  expect(screen.getByText("Role Changed")).toBeTruthy()
  expect(screen.getByText("Role")).toBeTruthy()
  expect(screen.getByText("role-1")).toBeTruthy()
  expect(screen.getByText("Role changed: User → Admin")).toBeTruthy()
  expect(screen.getByText("Page 1 of 2")).toBeTruthy()
  fireEvent.click(screen.getByLabelText("Go To Next Page"))
  expect(state.navigate).toHaveBeenCalledOnce()
  expect(
    state.navigate.mock.calls[0][0].search({ page: 1, perPage: 10 })
  ).toMatchObject({ page: 2, perPage: 10 })
  fireEvent.click(
    screen.getByRole("button", { name: "View details for ROLE_CHANGED" })
  )
  expect(screen.getByText("Audit event")).toBeTruthy()
  expect(screen.getByText("ada@example.test")).toBeTruthy()
  expect(screen.getByText("Before:").parentElement?.textContent).toContain(
    "User"
  )
})
