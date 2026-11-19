import { readTableSearch } from "@/lib/table-search-params"

const text = (value: unknown) =>
  typeof value === "string" ? value.trim().slice(0, 255) : ""
const date = (value: unknown) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
    ? value
    : ""

export function validateAuditSearch(search: Record<string, unknown>) {
  const { page, perPage } = readTableSearch(search)
  return {
    page,
    perPage,
    q: text(search.q),
    actor: text(search.actor),
    action: text(search.action),
    resourceType: text(search.resourceType),
    status:
      search.status === "success" || search.status === "failed"
        ? search.status
        : "",
    from: date(search.from),
    to: date(search.to),
    sort: search.sort === "oldest" ? "oldest" : "newest",
  }
}

export type AuditSearch = ReturnType<typeof validateAuditSearch>
