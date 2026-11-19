import type { SortingState, Updater } from "@tanstack/react-table"

export const PAGE_SIZES = [10, 20, 30, 40, 50] as const

export type PageSize = (typeof PAGE_SIZES)[number]

export function applyUpdater<T>(updater: Updater<T>, current: T): T {
  return typeof updater === "function"
    ? (updater as (old: T) => T)(current)
    : updater
}

export function toPageSize(value: number): PageSize {
  return PAGE_SIZES.includes(value as PageSize) ? (value as PageSize) : 10
}

export function readTableSearch(search: Record<string, unknown>) {
  const page = Number(search.page)
  const perPage = Number(search.perPage)
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    perPage: toPageSize(perPage),
    q: typeof search.q === "string" ? search.q : "",
    filters: Array.isArray(search.filters)
      ? search.filters
      : search.filters == null
        ? []
        : [search.filters],
  }
}

export const DEFAULT_SORT = "createdAt:desc"

/** Keeps a `field:asc|desc` sort only when the field is sortable. */
export function readSort(
  value: unknown,
  fields: readonly string[],
  fallback = DEFAULT_SORT
) {
  if (typeof value !== "string") return fallback
  const [field, direction] = value.split(":")
  return field && fields.includes(field) && /^(asc|desc)$/.test(direction ?? "")
    ? value
    : fallback
}

export function toSorting(sort: string): SortingState {
  const [id = "createdAt", direction] = sort.split(":")
  return [{ id, desc: direction === "desc" }]
}

export function fromSorting(sorting: SortingState) {
  const next = sorting[0]
  return next ? `${next.id}:${next.desc ? "desc" : "asc"}` : DEFAULT_SORT
}

export type ListQuery = {
  page: number
  perPage: number
  search?: string
  filters?: Array<{ field: string; operator: string; value: string }>
  sort?: string
}

/** Serializes a server list query; every value here must also be in the query key. */
export function listQueryString(query: ListQuery) {
  const params = new URLSearchParams({
    page: String(query.page),
    perPage: String(query.perPage),
  })
  if (query.search) params.set("search", query.search)
  for (const filter of query.filters ?? []) {
    params.append(
      "filter",
      `${filter.field}:${filter.operator}:${filter.value}`
    )
  }
  if (query.sort) params.set("sort", query.sort)
  return params.toString()
}
