import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, expect, it, vi } from "vitest"

import { AppAbilityProvider } from "@/features/authz"
import { ConsolePage } from "./console-page"

const fixture = vi.hoisted(() => {
  const foundAt = new Date().toISOString()
  return {
    data: {
      total: 12,
      strong: 5,
      bestScore: 66,
      lastFoundAt: foundAt,
      minMatchScore: 40,
      byStatus: { new: 9, prepared: 2, applied: 1, dismissed: 0 },
      watched: [
        "https://t.me/josad_software",
        "https://t.me/shegerjobs",
        "https://t.me/ethio_tech_jobs",
      ],
      channels: [
        {
          channel: "josad_software",
          total: 12,
          bestScore: 66,
          lastFoundAt: foundAt,
        },
        { channel: "shegerjobs", total: 0, bestScore: 0, lastFoundAt: null },
      ],
      top: [
        {
          id: "job-1",
          title: "Senior Frontend Engineer",
          company: "Bisviews",
          location: "Addis Ababa",
          channel: "josad_software",
          url: null,
          score: 66,
          status: "new",
          reasons: ['title matches "frontend engineer"', "remote-friendly"],
          gaps: [],
          matchedSkills: ["React", "TypeScript"],
          createdAt: foundAt,
        },
      ],
    },
  }
})

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useQuery: () => ({ isPending: false, isError: false, data: fixture.data }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}))

afterEach(cleanup)

it("reports what the agent watched, kept, and left silent", () => {
  render(
    <AppAbilityProvider
      rules={[{ action: "manage", subject: "all" }]}
      userId="user-1"
    >
      <ConsolePage />
    </AppAbilityProvider>
  )

  expect(
    screen.getByRole("heading", { name: "12 postings kept from 3 channels." })
  ).toBeTruthy()
  expect(screen.getByText("Read these first")).toBeTruthy()
  expect(screen.getByText("Senior Frontend Engineer")).toBeTruthy()
  expect(screen.getByText("React")).toBeTruthy()
  expect(screen.getByText("2 of 3 produced nothing kept.")).toBeTruthy()
})
