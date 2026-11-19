import { format } from "date-fns"

export const textFilterOperators = [
  { value: "equals", label: "Equals" },
  { value: "contains", label: "Contains" },
  { value: "notContains", label: "Does Not Contain" },
  { value: "startsWith", label: "Starts With" },
] as const

export const dateFilterOperators = [
  { value: "equals", label: "Equals" },
  { value: "before", label: "Before" },
  { value: "after", label: "After" },
] as const

const OPERATORS = new Set<string>(
  [...textFilterOperators, ...dateFilterOperators].map(({ value }) => value)
)

export type FilterField<TField extends string = string> = {
  value: TField
  label: string
  kind?: "text" | "date"
  placeholder?: string
}

/** One advanced filter as it is stored in the URL and sent to the API. */
export type FilterQuery = { field: string; operator: string; value: string }
/** A filter while it is edited in the UI; `id` keys the row. */
export type FilterRule = FilterQuery & { id: string }

export function operatorsFor(field: FilterField | undefined) {
  return field?.kind === "date" ? dateFilterOperators : textFilterOperators
}

/** Reads a `field:operator:value` token (or object) for one of `fields`. */
export function parseFilter(
  value: unknown,
  fields: readonly FilterField[]
): FilterQuery | null {
  let candidate = value
  if (typeof value === "string") {
    const first = value.indexOf(":")
    const second = value.indexOf(":", first + 1)
    if (first < 0 || second < 0) return null
    candidate = {
      field: value.slice(0, first),
      operator: value.slice(first + 1, second),
      value: value.slice(second + 1),
    }
  }
  if (!candidate || typeof candidate !== "object") return null
  const { field, operator, value: text } = candidate as Record<string, unknown>
  const definition = fields.find((item) => item.value === field)
  if (
    !definition ||
    typeof operator !== "string" ||
    !operatorsFor(definition).some((item) => item.value === operator) ||
    typeof text !== "string" ||
    !text
  )
    return null
  return { field: definition.value, operator, value: text }
}

export function serializeFilter(filter: FilterQuery) {
  return `${filter.field}:${filter.operator}:${filter.value}`
}

/** Gives URL filters stable row ids without storing ids in the URL. */
export function withIds(filters: FilterQuery[]): FilterRule[] {
  return filters.map((filter, index) => ({
    ...filter,
    id: `${filter.field}-${index}`,
  }))
}

/** Drops UI-only ids and blank rules before writing to the URL. */
export function withoutIds(rules: FilterRule[]): FilterQuery[] {
  return rules.flatMap(({ field, operator, value }) =>
    value.trim() && OPERATORS.has(operator)
      ? [{ field, operator, value: value.trim() }]
      : []
  )
}

/** Normalizes a value for comparison: dates as local `yyyy-MM-dd`, text in lower case. */
export function filterValue(raw: unknown, kind: FilterField["kind"] = "text") {
  if (kind !== "date") return String(raw ?? "").toLowerCase()
  if (raw == null || raw === "") return ""
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const date = new Date(raw as string)
  return Number.isNaN(date.getTime()) ? "" : format(date, "yyyy-MM-dd")
}

function matchesRule(values: string[], rule: FilterQuery) {
  const target = rule.value.trim().toLowerCase()
  if (rule.operator === "notContains")
    return values.every((value) => !value.includes(target))
  return values.some((value) => {
    switch (rule.operator) {
      case "equals":
        return value === target
      case "contains":
        return value.includes(target)
      case "startsWith":
        return value.startsWith(target)
      case "before":
        return value !== "" && value < target
      case "after":
        return value !== "" && value > target
      default:
        return false
    }
  })
}

type ReadField<T> = (record: T, field: string) => unknown

/**
 * Filters records on the client. `search` matches `searchText(record)`, and every
 * rule must match (rules on one field and across fields combine with AND).
 * `read` may return an array, such as several tag labels for one record.
 */
export function filterRecords<T>(
  records: T[],
  {
    search,
    rules,
    fields,
    read,
    searchText,
  }: {
    search: string
    rules: FilterQuery[]
    fields: readonly FilterField[]
    read: ReadField<T>
    searchText: (record: T) => string
  }
) {
  const term = search.trim().toLowerCase()
  return records.filter((record) => {
    if (term && !searchText(record).toLowerCase().includes(term)) return false
    return rules.every((rule) => {
      const field = fields.find((item) => item.value === rule.field)
      if (!field) return false
      const raw = read(record, rule.field)
      const values = (Array.isArray(raw) ? raw : [raw]).map((value) =>
        filterValue(value, field.kind)
      )
      return matchesRule(values, rule)
    })
  })
}
