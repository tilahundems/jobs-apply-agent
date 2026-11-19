import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AppAbilityRule } from "@/features/authz"
import { AppAbilityProvider } from "@/features/authz"
import type { Task } from "@/features/tasks/tasks-api"
import { TaskDetails } from "@/features/tasks/tasks-details"
import type { Project } from "./projects-api"
import { ProjectDetails } from "./projects-details"

const state = vi.hoisted(() => ({
  project: null as Project | null,
  tasks: [] as Task[],
}))
vi.mock("@tanstack/react-query", () => ({
  queryOptions: (options: unknown) => options,
  useSuspenseQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === "projects" ? state.project : state.tasks,
  }),
  useQuery: () => ({
    data: state.tasks,
    error: null,
    isPending: false,
  }),
}))
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({
    to,
    params = {},
    children,
    ...props
  }: {
    to: string
    params?: Record<string, string>
    children: ReactNode
  }) => (
    <a
      href={Object.entries(params).reduce(
        (path, [key, value]) => path.replace(`$${key}`, value),
        to
      )}
      {...props}
    >
      {children}
    </a>
  ),
}))
vi.mock("./projects-api", () => ({
  projectQueryOptions: (id: string) => ({ queryKey: ["projects", id] }),
}))
vi.mock("@/features/tasks/tasks-api", () => ({
  tasksQueryOptions: { queryKey: ["tasks"] },
  TASK_STATUSES: ["todo", "in_progress", "done"],
  TASK_STATUS_LABELS: {
    todo: "To do",
    in_progress: "In progress",
    done: "Done",
  },
  TASK_PRIORITY_LABELS: { low: "Low", medium: "Medium", high: "High" },
}))
vi.mock("./projects-form", () => ({ ProjectsForm: () => null }))
vi.mock("./projects-delete-dialog", () => ({
  ProjectsDeleteDialog: () => null,
}))
vi.mock("@/features/tasks/tasks-delete-dialog", () => ({
  TasksDeleteDialog: () => null,
}))
vi.mock("@/features/tasks/tasks-table-columns", () => ({
  TaskRowActions: () => null,
}))
vi.mock("@/features/tasks/tasks-form", () => ({
  TasksForm: ({
    open,
    defaultProjectId,
    task,
  }: {
    open: boolean
    defaultProjectId?: string
    task?: Task
  }) =>
    open ? (
      <div
        role="dialog"
        aria-label={task ? `Edit ${task.title}` : `Add to ${defaultProjectId}`}
      />
    ) : null,
}))

const adminRules: AppAbilityRule[] = [{ action: "manage", subject: "all" }]

function renderWithAbility(
  ui: ReactNode,
  rules: AppAbilityRule[] = adminRules
) {
  return render(
    <AppAbilityProvider rules={rules} userId="user-1">
      {ui}
    </AppAbilityProvider>
  )
}

function makeTask(
  id: string,
  status: Task["status"],
  projectId = "project-1"
): Task {
  return {
    id,
    title: id,
    status,
    priority: "medium",
    projectId,
    project: null,
    assignee: null,
    assigneeId: null,
    description: null,
    dueDate: null,
    createdAt: "2026-09-06T12:00:00Z",
    updatedAt: "2026-09-06T12:00:00Z",
  }
}

beforeEach(() => {
  state.project = {
    id: "project-1",
    name: "Website refresh",
    description: "A clearer experience",
    tags: [
      {
        id: "tag-1",
        label: "Design",
        color: "#00ff00",
        createdAt: "2026-09-06",
        updatedAt: "2026-09-06",
      },
    ],
    createdAt: "2026-09-06",
    updatedAt: "2026-09-06",
    deletedAt: null,
  }
  state.tasks = [
    makeTask("Write brief", "todo"),
    makeTask("Review design", "in_progress"),
    makeTask("Ship design", "done"),
    makeTask("Unrelated task", "todo", "project-2"),
  ]
})
afterEach(cleanup)

describe("project details", () => {
  it("limits related tasks to this project and links to task details", () => {
    renderWithAbility(<ProjectDetails projectId="project-1" />)
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Overview",
      "Tasks",
    ])
    expect(screen.getByText("Design")).toBeTruthy()
    expect(
      screen.getByRole("heading", { name: "Website refresh" })
    ).toBeTruthy()
    expect(screen.queryByRole("complementary")).toBeNull()
    expect(screen.getByText("1 of 3")).toBeTruthy()
    fireEvent.click(screen.getByRole("tab", { name: "Tasks" }))
    expect(
      screen.getByRole("heading", { name: "Website refresh" })
    ).toBeTruthy()
    expect(screen.getByText("A clearer experience")).toBeTruthy()
    expect(screen.queryByText("Unrelated task")).toBeNull()
    expect(
      screen.getByRole("link", { name: "Write brief" }).getAttribute("href")
    ).toBe("/tasks/Write brief")
    expect(screen.getByRole("searchbox", { name: "Search Tasks" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Export" })).toBeTruthy()
    expect(screen.getByText("Page 1 of 1")).toBeTruthy()
  })

  it("opens task creation from the tasks header", () => {
    renderWithAbility(<ProjectDetails projectId="project-1" />)
    fireEvent.click(screen.getByRole("tab", { name: "Tasks" }))
    const section = screen.getByRole("region", { name: "Tasks" })
    fireEvent.click(within(section).getByRole("button", { name: "Add Task" }))
    expect(
      screen.getByRole("dialog", { name: "Add to project-1" })
    ).toBeTruthy()
  })

  it("applies and clears field rules on the related tasks table", () => {
    renderWithAbility(<ProjectDetails projectId="project-1" />)
    fireEvent.click(screen.getByRole("tab", { name: "Tasks" }))
    fireEvent.click(screen.getByRole("button", { name: "Filters" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Filter 1 value" }), {
      target: { value: "Ship design" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Apply Filter" }))
    expect(screen.getByRole("link", { name: "Ship design" })).toBeTruthy()
    expect(screen.queryByRole("link", { name: "Write brief" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }))
    fireEvent.click(screen.getByRole("button", { name: "Add Filter" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Filter 2 value" }), {
      target: { value: "Write brief" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Apply Filter" }))
    expect(screen.getByText("No results.")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }))
    fireEvent.click(screen.getByRole("button", { name: "Clear All" }))
    expect(screen.getByRole("link", { name: "Write brief" })).toBeTruthy()
  })

  it("opens task creation scoped to an empty project", () => {
    state.tasks = []
    renderWithAbility(<ProjectDetails projectId="project-1" />)
    fireEvent.click(screen.getByRole("tab", { name: "Tasks" }))
    const section = screen.getByRole("region", { name: "Tasks" })
    expect(within(section).getByText("No results.")).toBeTruthy()
    fireEvent.click(within(section).getByRole("button", { name: "Add Task" }))
    expect(
      screen.getByRole("dialog", { name: "Add to project-1" })
    ).toBeTruthy()
  })

  it("hides task creation when the user cannot create tasks", () => {
    renderWithAbility(<ProjectDetails projectId="project-1" />, [
      { action: "read", subject: "Task" },
    ])
    fireEvent.click(screen.getByRole("tab", { name: "Tasks" }))
    const section = screen.getByRole("region", { name: "Tasks" })
    expect(
      within(section).queryByRole("button", { name: "Add Task" })
    ).toBeNull()
  })
})

describe("task details", () => {
  it("keeps single related values in the overview without tabs", () => {
    state.tasks[0] = {
      ...state.tasks[0],
      project: { id: "project-1", name: "Website refresh" },
      description: "Prepare the project brief",
      assigneeId: "user-1",
      assignee: { id: "user-1", name: "Ada", email: "ada@example.com" },
    }
    renderWithAbility(<TaskDetails taskId="Write brief" />)
    expect(screen.queryByRole("tab")).toBeNull()
    const header = screen.getByRole("banner")
    const heading = within(header).getByRole("heading", { name: "Write brief" })
    const description = within(header).getByText("Prepare the project brief")
    const badge = within(header).getByText("To do")
    const details = screen.getByText("ada@example.com").closest("dl")
    expect(
      heading.compareDocumentPosition(description) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      description.compareDocumentPosition(badge) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(details).toBeTruthy()
    expect(
      badge.compareDocumentPosition(details!) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Write brief" })).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Website refresh" }).getAttribute("href")
    ).toBe("/projects/project-1")
    expect(screen.getByText("ada@example.com")).toBeTruthy()
  })

  it("shows meaningful missing values and opens the correct edit form", () => {
    state.tasks[0] = { ...state.tasks[0], projectId: null }
    renderWithAbility(<TaskDetails taskId="Write brief" />)
    expect(screen.getByText("Unassigned")).toBeTruthy()
    expect(screen.getByText("Not set")).toBeTruthy()
    expect(screen.getByText("No project assigned")).toBeTruthy()
    expect(screen.queryByRole("tab")).toBeNull()
    expect(screen.queryByText("No description yet.")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Add Description" }))
    expect(
      screen.getByRole("dialog", { name: "Edit Write brief" })
    ).toBeTruthy()
  })

  it("provides a recovery link when the task is missing", () => {
    renderWithAbility(<TaskDetails taskId="missing" />)
    expect(screen.getByText("Task not found")).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Back To Tasks" }).getAttribute("href")
    ).toBe("/tasks")
  })
})
