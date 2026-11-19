import { describe, expect, it } from "vitest"
import { getGroupedColumnRowSpans } from "./group-rows"

function row(id: string, subject: string) {
  return {
    id,
    getValue: (columnId: string) => (columnId === "subject" ? subject : id),
  }
}

describe("getGroupedColumnRowSpans", () => {
  it("spans consecutive rows that share a subject", () => {
    const spans = getGroupedColumnRowSpans(
      [
        row("1", "Project"),
        row("2", "Project"),
        row("3", "Task"),
        row("4", "Task"),
        row("5", "Task"),
        row("6", "User"),
      ],
      "subject"
    )

    expect(Object.fromEntries(spans)).toEqual({
      "1": 2,
      "2": 0,
      "3": 3,
      "4": 0,
      "5": 0,
      "6": 1,
    })
  })

  it("does not span subjects that are not adjacent", () => {
    const spans = getGroupedColumnRowSpans(
      [row("1", "Task"), row("2", "Project"), row("3", "Task")],
      "subject"
    )

    expect(Object.fromEntries(spans)).toEqual({
      "1": 1,
      "2": 1,
      "3": 1,
    })
  })
})
