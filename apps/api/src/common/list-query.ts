import type { ListFilterOperator } from "@et/contracts"
import { eq, not, type SQL, type SQLWrapper, sql } from "drizzle-orm"

export type ListFilterRule = {
  field: string
  operator: ListFilterOperator
  value: string
}

export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&")
}

/**
 * SQLite's `LIKE` is case-insensitive for ASCII and treats backslash literally,
 * so the escape character is declared explicitly instead of relying on the
 * Postgres default.
 */
export function likeMatches(
  column: SQLWrapper,
  value: string,
  mode: "contains" | "startsWith" = "contains"
): SQL {
  const escaped = escapeLike(value)
  const pattern = mode === "contains" ? `%${escaped}%` : `${escaped}%`
  return sql`${column} like ${pattern} escape '\\'`
}

/** Case-insensitive text predicate; `notContains` is returned un-negated with `negate: true`. */
export function textMatch(column: SQLWrapper, rule: ListFilterRule) {
  const predicate =
    rule.operator === "equals"
      ? eq(sql`lower(${column})`, rule.value.toLowerCase())
      : likeMatches(
          column,
          rule.value,
          rule.operator === "startsWith" ? "startsWith" : "contains"
        )
  return { predicate, negate: rule.operator === "notContains" }
}

export function textFilter(column: SQLWrapper, rule: ListFilterRule): SQL {
  const { predicate, negate } = textMatch(column, rule)
  return negate ? not(predicate) : predicate
}

/**
 * Compares the column's calendar date with a `YYYY-MM-DD` value. Timestamp
 * columns hold Unix seconds, so they are converted before comparing.
 */
export function dateFilter(column: SQLWrapper, rule: ListFilterRule): SQL {
  const isTimestamp = (column as { dataType?: string }).dataType === "date"
  const date = isTimestamp
    ? sql`date(${column}, 'unixepoch')`
    : sql`date(${column})`
  const value = sql`date(${rule.value})`
  if (rule.operator === "before") return sql`${date} < ${value}`
  if (rule.operator === "after") return sql`${date} > ${value}`
  return sql`${date} = ${value}`
}

/**
 * Enum values whose stored value or display label matches the rule, so
 * `status contains "progress"` finds `in_progress`.
 */
export function matchingEnumValues<T extends string>(
  labels: Record<T, string>,
  rule: ListFilterRule
): T[] {
  const target = rule.value.toLowerCase()
  const test = (text: string) =>
    rule.operator === "equals"
      ? text === target
      : rule.operator === "startsWith"
        ? text.startsWith(target)
        : text.includes(target)
  return (Object.keys(labels) as T[]).filter((value) => {
    const texts = [value, labels[value]].map((text) => text.toLowerCase())
    return rule.operator === "notContains"
      ? texts.every((text) => !test(text))
      : texts.some(test)
  })
}

export async function paginate<T>(
  query: { page: number; perPage: number },
  rows: (window: { limit: number; offset: number }) => Promise<T[]>,
  total: () => Promise<Array<{ value: number }>>
) {
  // Sequential: in tenant mode both queries share one request transaction.
  const items = await rows({
    limit: query.perPage,
    offset: (query.page - 1) * query.perPage,
  })
  const totalRows = await total()
  return { items, total: totalRows[0]?.value ?? 0 }
}
