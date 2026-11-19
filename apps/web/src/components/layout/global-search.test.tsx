import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeAll, expect, it, vi } from "vitest"
import { GlobalSearch } from "./global-search"

const state = vi.hoisted(() => ({
  navigate: vi.fn(),
  denied: new Set<string>(),
  queries: [] as Array<{ queryKey: readonly unknown[]; enabled?: boolean }>,
}))

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => state.navigate }))
vi.mock("@/features/i18n/i18n-provider", () => ({
  useI18n: () => ({ t: (value: string) => value }),
}))
vi.mock("@/features/authz", () => ({
  useAppAbility: () => ({
    can: (_action: string, subject: string) => !state.denied.has(subject),
  }),
}))
vi.mock("@tanstack/react-query", async (original) => ({
  ...(await original<object>()),
  useQuery: (options: { queryKey: readonly unknown[]; enabled?: boolean }) => {
    state.queries.push(options)
    if (options.queryKey[0] === "tasks") {
      return {
        data: [{ id: "task-1", title: "Plan launch" }],
        isFetching: false,
      }
    }
    return { data: undefined, isFetching: false }
  },
}))

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
  state.navigate.mockClear()
  state.denied.clear()
  state.queries.length = 0
})

it("opens with Ctrl+K and navigates to a matching task", () => {
  render(<GlobalSearch />)
  fireEvent.keyDown(document, { key: "k", ctrlKey: true })
  fireEvent.change(
    screen.getByRole("combobox", { name: "Search pages and records" }),
    {
      target: { value: "launch" },
    }
  )
  fireEvent.click(screen.getByText("Plan launch"))
  expect(state.navigate).toHaveBeenCalledWith({
    to: "/tasks/$taskId",
    params: { taskId: "task-1" },
  })
  expect(screen.queryByRole("dialog")).toBeNull()
})

it("hides forbidden pages and never runs their queries", () => {
  state.denied.add("Task")
  render(<GlobalSearch />)
  fireEvent.click(screen.getByRole("button", { name: "Search" }))
  expect(screen.queryByText("Tasks")).toBeNull()
  fireEvent.change(
    screen.getByRole("combobox", { name: "Search pages and records" }),
    {
      target: { value: "launch" },
    }
  )
  expect(screen.queryByText("Plan launch")).toBeNull()
  expect(
    state.queries.find((query) => query.queryKey[0] === "tasks")?.enabled
  ).toBe(false)
})
