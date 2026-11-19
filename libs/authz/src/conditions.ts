import {
  type AnyColumn,
  and,
  eq,
  getTableColumns,
  gt,
  gte,
  isNull,
  lt,
  lte,
  not,
  or,
  type SQL,
  sql,
  type Table,
} from "drizzle-orm"

import type { PermissionAbility } from "./types.js"

export class UnsupportedPermissionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UnsupportedPermissionError"
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  )
}

function listed(value: string | readonly string[]): string[] {
  return typeof value === "string" ? [value] : [...value]
}

function all(parts: SQL[]): SQL {
  return and(...parts) ?? sql`true`
}

function any(parts: SQL[]): SQL {
  return or(...parts) ?? sql`false`
}

/** Later CASL rules have higher priority; reverse so CASE can first-match. */
export function relevantRules(
  ability: PermissionAbility,
  action: string,
  subject: string
) {
  return [...ability.rules].reverse().filter((rule) => {
    const actions = listed(rule.action)
    const subjects = listed(rule.subject)

    return (
      (actions.includes(action) || actions.includes("manage")) &&
      (subjects.includes(subject) || subjects.includes("all"))
    )
  })
}

function scalar(
  column: AnyColumn,
  value: unknown
): string | number | boolean | Date | bigint | null {
  if (value === null) return null
  const type = column.dataType
  if (
    (type === "string" && typeof value === "string") ||
    (type === "number" &&
      typeof value === "number" &&
      Number.isFinite(value)) ||
    (type === "boolean" && typeof value === "boolean") ||
    (type === "bigint" && typeof value === "bigint") ||
    (type === "date" &&
      value instanceof Date &&
      Number.isFinite(value.getTime()))
  ) {
    return value
  }
  throw new UnsupportedPermissionError(
    `Invalid permission value for column ${column.name}`
  )
}

function equal(column: AnyColumn, value: unknown): SQL {
  const checked = scalar(column, value)
  // SQL NULL must become a boolean before negating or applying rule precedence.
  return checked === null
    ? isNull(column)
    : sql`coalesce(${eq(column, checked)}, false)`
}

function fieldCondition(column: AnyColumn, value: unknown): SQL {
  if (!object(value)) return equal(column, value)
  if (Object.keys(value).length === 0) {
    throw new UnsupportedPermissionError(
      "Empty field condition is not supported"
    )
  }
  return all(
    Object.entries(value).map(([operator, operand]) => {
      switch (operator) {
        case "$eq":
          return equal(column, operand)
        case "$ne":
          return not(equal(column, operand))
        case "$in":
        case "$nin": {
          if (!Array.isArray(operand)) {
            throw new UnsupportedPermissionError(
              `${operator} requires an array`
            )
          }
          const expression = any(operand.map((entry) => equal(column, entry)))
          return operator === "$nin" ? not(expression) : expression
        }
        case "$not":
          if (!object(operand)) {
            throw new UnsupportedPermissionError(
              "$not requires an operator object"
            )
          }
          return not(fieldCondition(column, operand))
        case "$gt":
        case "$gte":
        case "$lt":
        case "$lte": {
          const checked = scalar(column, operand)
          // Text/enum ordering depends on DB collation; do not pretend it is JS ordering.
          if (
            checked === null ||
            !["number", "date", "bigint"].includes(column.dataType)
          ) {
            throw new UnsupportedPermissionError(
              `${operator} requires a numeric or Date column and a non-null value`
            )
          }
          const compare = { $gt: gt, $gte: gte, $lt: lt, $lte: lte }[operator]
          return sql`coalesce(${compare(column, checked)}, false)`
        }
        default:
          throw new UnsupportedPermissionError(
            `Unsupported permission operator: ${operator}`
          )
      }
    })
  )
}

/** Flat scalar columns only. Unknown columns/operators fail closed. */
export function conditionToSql(table: Table, conditions: unknown): SQL {
  if (!object(conditions)) {
    throw new UnsupportedPermissionError(
      "Permission conditions must be an object"
    )
  }
  const columns = getTableColumns(table)
  return all(
    Object.entries(conditions).map(([key, value]) => {
      if (["$and", "$or", "$nor"].includes(key)) {
        if (!Array.isArray(value)) {
          throw new UnsupportedPermissionError(`${key} requires an array`)
        }
        const parts = value.map((entry) => conditionToSql(table, entry))
        return key === "$and"
          ? all(parts)
          : key === "$or"
            ? any(parts)
            : not(any(parts))
      }
      const column = Object.hasOwn(columns, key) ? columns[key] : undefined
      if (
        !column ||
        ["array", "json", "custom", "buffer"].includes(column.dataType)
      ) {
        throw new UnsupportedPermissionError(
          `Unsupported permission column: ${key}`
        )
      }
      return fieldCondition(column, value)
    })
  )
}

function rowRulesOf(
  ability: PermissionAbility,
  action: string,
  subject: string
) {
  const rules = relevantRules(ability, action, subject)
  if (rules.some((rule) => rule.fields?.length)) {
    throw new UnsupportedPermissionError(
      "Field-scoped permissions require a field-aware endpoint"
    )
  }
  return rules
}

/** CASE implements CASL's first matching rule, highest priority first. */
export function conditionsFor(
  ability: PermissionAbility,
  action: string,
  subject: string,
  table: Table
): SQL {
  const rules = rowRulesOf(ability, action, subject)
  if (!rules.length) return sql`false`

  const [first] = rules
  if (first && first.conditions == null) {
    return first.inverted ? sql`false` : sql`true`
  }

  const branches = rules.map((rule) => {
    const condition =
      rule.conditions == null
        ? sql`true`
        : conditionToSql(table, rule.conditions)
    return sql`when ${condition} then ${rule.inverted ? sql`false` : sql`true`}`
  })
  return sql`(case ${sql.join(branches, sql` `)} else false end)`
}
