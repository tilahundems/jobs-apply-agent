import { describe, expect, it } from "vitest"
import { createTableSearch } from "./create-table-search"
import type { FilterField } from "./list-filters"
import {
  filterRecords,
  parseFilter,
  serializeFilter,
  withIds,
  withoutIds,
} from "./list-filters"

const fields: FilterField[] = [
  { value: "name", label: "Name" },
  { value: "tags", label: "Tags" },
  { value: "createdAt", label: "Created", kind: "date" },
]

describe("filter tokens", () => {
  it("round-trips a readable field:operator:value token", () => {
    const filter = { field: "name", operator: "contains", value: "design" }
    expect(parseFilter(serializeFilter(filter), fields)).toEqual(filter)
  })

  it("keeps colons inside the value", () => {
    expect(parseFilter("name:equals:a:b", fields)).toEqual({
      field: "name",
      operator: "equals",
      value: "a:b",
    })
  })

  it("rejects unknown fields, operators that do not fit the field, and empty values", () => {
    expect(parseFilter("owner:equals:ada", fields)).toBeNull()
    expect(parseFilter("name:matches:ada", fields)).toBeNull()
    expect(parseFilter("createdAt:contains:2026", fields)).toBeNull()
    expect(parseFilter("name:before:2026-01-01", fields)).toBeNull()
    expect(parseFilter("name:equals:", fields)).toBeNull()
    expect(parseFilter("name-equals-ada", fields)).toBeNull()
  })

  it("gives URL filters stable ids and drops ids and blank rules on write", () => {
    const rules = withIds([
      { field: "name", operator: "contains", value: "a" },
      { field: "tags", operator: "equals", value: "b" },
    ])
    expect(rules.map(({ id }) => id)).toEqual(["name-0", "tags-1"])
    expect(
      withoutIds([
        ...rules,
        { id: "x", field: "name", operator: "equals", value: "  " },
      ])
    ).toEqual([
      { field: "name", operator: "contains", value: "a" },
      { field: "tags", operator: "equals", value: "b" },
    ])
  })
})

type Row = { name: string; tags: string[]; createdAt: string }
const rows: Row[] = [
  { name: "Website", tags: ["design", "web"], createdAt: "2026-03-10T09:00" },
  { name: "Web API", tags: [], createdAt: "2026-03-12T09:00" },
  { name: "Mobile", tags: ["design"], createdAt: "2026-03-14T09:00" },
]

function names(
  search: string,
  rules: Array<{ field: string; operator: string; value: string }>
) {
  return filterRecords(rows, {
    search,
    rules,
    fields,
    read: (row, field) => row[field as keyof Row],
    searchText: (row) => row.name,
  }).map((row) => row.name)
}

describe("filterRecords", () => {
  it("combines search with rules on the same and different fields", () => {
    expect(names("web", [])).toEqual(["Website", "Web API"])
    expect(
      names("web", [{ field: "name", operator: "notContains", value: "api" }])
    ).toEqual(["Website"])
    expect(
      names("", [
        { field: "name", operator: "startsWith", value: "w" },
        { field: "name", operator: "contains", value: "site" },
      ])
    ).toEqual(["Website"])
  })

  it("matches list values individually and keeps empty lists for exclusions", () => {
    expect(
      names("", [{ field: "tags", operator: "equals", value: "WEB" }])
    ).toEqual(["Website"])
    expect(
      names("", [{ field: "tags", operator: "notContains", value: "design" }])
    ).toEqual(["Web API"])
  })

  it("compares local calendar dates and supports a range", () => {
    expect(
      names("", [
        { field: "createdAt", operator: "equals", value: "2026-03-12" },
      ])
    ).toEqual(["Web API"])
    expect(
      names("", [
        { field: "createdAt", operator: "after", value: "2026-03-10" },
        { field: "createdAt", operator: "before", value: "2026-03-14" },
      ])
    ).toEqual(["Web API"])
  })

  it("returns nothing for a rule on an unknown field", () => {
    expect(
      names("", [{ field: "owner", operator: "equals", value: "ada" }])
    ).toEqual([])
  })
})

describe("createTableSearch", () => {
  const serverList = createTableSearch({
    fields,
    sortFields: ["name", "createdAt"],
  })
  const clientList = createTableSearch({ fields })

  it("defaults page params and keeps only valid filters", () => {
    expect(
      serverList.validateSearch({
        page: "0",
        perPage: "7",
        q: "web",
        filters: ["name:contains:web", "owner:equals:ada"],
      })
    ).toEqual({
      page: 1,
      perPage: 10,
      q: "web",
      filters: [{ field: "name", operator: "contains", value: "web" }],
      sort: "createdAt:desc",
    })
  })

  it("keeps a sort only for sortable fields, and only on server-sorted lists", () => {
    expect(serverList.validateSearch({ sort: "name:asc" }).sort).toBe(
      "name:asc"
    )
    expect(serverList.validateSearch({ sort: "tags:asc" }).sort).toBe(
      "createdAt:desc"
    )
    expect(clientList.validateSearch({ sort: "name:asc" })).not.toHaveProperty(
      "sort"
    )
  })

  it("builds the server query used in loaders and query keys", () => {
    expect(serverList.toQuery({ page: 2, perPage: 20, q: "x" })).toEqual({
      page: 2,
      perPage: 20,
      search: "x",
      filters: [],
      sort: "createdAt:desc",
    })
  })
})
