import { afterEach, expect, it, vi } from "vitest"
import { auditLogsQueryOptions } from "./audit-api"
import { validateAuditSearch } from "./audit-search-params"

afterEach(() => vi.unstubAllGlobals())

it("uses bounded table search params", () => {
  expect(validateAuditSearch({ page: "2", perPage: "20" })).toMatchObject({
    page: 2,
    perPage: 20,
  })
  expect(validateAuditSearch({ page: "-1", perPage: "100" })).toMatchObject({
    page: 1,
    perPage: 10,
  })
  expect(
    validateAuditSearch({ from: "2026-02-31", status: "unknown", sort: "bad" })
  ).toMatchObject({
    from: "",
    status: "",
    sort: "newest",
  })
})

it("encodes actor, action, resource, and full-day date filters", async () => {
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ items: [], total: 0 }),
  })
  vi.stubGlobal("fetch", fetch)
  const options = auditLogsQueryOptions(
    validateAuditSearch({
      actor: "Ada",
      action: "Role Changed",
      resourceType: "user",
      from: "2026-09-24",
      to: "2026-09-25",
      sort: "oldest",
    })
  )
  await options.queryFn?.({} as never)
  const url = new URL(fetch.mock.calls[0][0], "http://localhost")
  expect(options.queryKey[1]).toMatchObject({ actor: "Ada", sort: "oldest" })
  expect(url.searchParams.get("actor")).toBe("Ada")
  expect(url.searchParams.get("action")).toBe("Role_Changed")
  expect(url.searchParams.get("resourceType")).toBe("user")
  expect(url.searchParams.get("sort")).toBe("oldest")
  expect(new Date(url.searchParams.get("from")!).getTime()).toBeLessThan(
    new Date(url.searchParams.get("to")!).getTime()
  )
})

it("keys and requests each server page separately", async () => {
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ items: [], total: 12 }),
  })
  vi.stubGlobal("fetch", fetch)

  const search = validateAuditSearch({
    page: "2",
    perPage: "10",
    q: "role",
    status: "failed",
  })
  const options = auditLogsQueryOptions(search)
  expect(options.queryKey).toEqual(["audit-logs", search])
  await options.queryFn?.({} as never)
  const [path, init] = fetch.mock.calls[0]
  expect(new URL(path, "http://localhost").searchParams).toEqual(
    new URLSearchParams("page=2&perPage=10&sort=newest&q=role&status=failed")
  )
  expect(init).toEqual(expect.objectContaining({ credentials: "include" }))
})
