import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { TaskPriorityBadge, TaskStatusBadge } from "./task-values"

afterEach(cleanup)

describe("TaskStatusBadge", () => {
  it("colors status icons by meaning", () => {
    const { rerender, container } = render(<TaskStatusBadge status="todo" />)
    expect(container.querySelector("svg")?.getAttribute("class")).toContain(
      "text-muted-foreground"
    )

    rerender(<TaskStatusBadge status="in_progress" />)
    expect(container.querySelector("svg")?.getAttribute("class")).toContain(
      "text-sky-600"
    )

    rerender(<TaskStatusBadge status="done" />)
    expect(container.querySelector("svg")?.getAttribute("class")).toContain(
      "text-emerald-600"
    )
  })
})

describe("TaskPriorityBadge", () => {
  it("colors priority icons by meaning", () => {
    const { rerender, container } = render(<TaskPriorityBadge priority="low" />)
    expect(container.querySelector("svg")?.getAttribute("class")).toContain(
      "text-muted-foreground"
    )

    rerender(<TaskPriorityBadge priority="medium" />)
    expect(container.querySelector("svg")?.getAttribute("class")).toContain(
      "text-amber-500"
    )

    rerender(<TaskPriorityBadge priority="high" />)
    expect(container.querySelector("svg")?.getAttribute("class")).toContain(
      "text-red-600"
    )
  })
})
