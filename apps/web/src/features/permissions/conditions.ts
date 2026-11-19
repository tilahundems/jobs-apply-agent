import type { ConditionField, PermissionConditions } from "./permissions-api"

export const OPERATORS = [
  { value: "$eq", label: "is" },
  { value: "$ne", label: "is not" },
  { value: "$in", label: "is any of" },
  { value: "$nin", label: "is none of" },
  { value: "$gt", label: "is greater than" },
  { value: "$gte", label: "is at least" },
  { value: "$lt", label: "is less than" },
  { value: "$lte", label: "is at most" },
] as const
export type ConditionRow = {
  id: string
  field: string
  operator: string
  value: string
  source: "value" | "user" | "null"
}
export const newCondition = (): ConditionRow => ({
  id: crypto.randomUUID(),
  field: "",
  operator: "$eq",
  value: "",
  source: "value",
})
export const USER_ID = "${user.id}"

export function conditionsFromRows(
  rows: ConditionRow[],
  fields: ConditionField[]
): PermissionConditions {
  if (!rows.length) return null
  const entries = new Map<
    string,
    Record<
      string,
      string | number | boolean | null | Array<string | number | boolean | null>
    >
  >()
  for (const row of rows) {
    const field = fields.find((item) => item.name === row.field)
    if (!field) throw new Error("Choose a field for every condition.")
    if (!OPERATORS.some((item) => item.value === row.operator))
      throw new Error("Choose a supported operator.")
    if (
      ["$gt", "$gte", "$lt", "$lte"].includes(row.operator) &&
      field.type !== "number"
    )
      throw new Error("Ordering comparisons require a number field.")
    const parse = (text: string) => {
      if (row.source === "null") return null
      if (row.source === "user") {
        if (field.type !== "string")
          throw new Error("Current user requires a text field.")
        return USER_ID
      }
      if (field.type === "boolean") {
        if (!["true", "false"].includes(text))
          throw new Error(`Choose true or false for ${field.name}.`)
        return text === "true"
      }
      if (field.type === "number") {
        if (!text.trim() || !Number.isFinite(Number(text)))
          throw new Error(`Enter a number for ${field.name}.`)
        return Number(text)
      }
      if (!text.trim()) throw new Error(`Enter a value for ${field.name}.`)
      return text.trim()
    }
    const value = ["$in", "$nin"].includes(row.operator)
      ? (row.source === "value" ? row.value.split("\n") : [""]).map(parse)
      : parse(row.value)
    const operators = entries.get(row.field) ?? {}
    if (Object.hasOwn(operators, row.operator))
      throw new Error(`Use ${row.operator} only once for ${row.field}.`)
    operators[row.operator] = value
    entries.set(row.field, operators)
  }
  return Object.fromEntries(entries)
}

export function rowsFromConditions(
  conditions: PermissionConditions
): ConditionRow[] | null {
  if (!conditions) return []
  const rows: ConditionRow[] = []
  for (const [field, condition] of Object.entries(conditions)) {
    if (field.startsWith("$")) return null
    const operators =
      condition !== null &&
      typeof condition === "object" &&
      !Array.isArray(condition)
        ? condition
        : { $eq: condition }
    if (!Object.keys(operators).length) return null
    for (const [operator, value] of Object.entries(operators)) {
      if (!OPERATORS.some((item) => item.value === operator)) return null
      const list = ["$in", "$nin"].includes(operator)
      if (list !== Array.isArray(value)) return null
      const values = Array.isArray(value) ? value : [value]
      // Keep values the simple editor cannot represent losslessly in JSON mode.
      if (
        !values.length ||
        values.some(
          (item) =>
            (typeof item === "object" && item !== null) ||
            (typeof item === "string" &&
              (!item.trim() || item !== item.trim() || item.includes("\n")))
        )
      )
        return null
      if (list && values.some((item) => item === null || item === USER_ID))
        return null
      rows.push({
        id: crypto.randomUUID(),
        field,
        operator,
        source: value === null ? "null" : value === USER_ID ? "user" : "value",
        value: values.map(String).join("\n"),
      })
    }
  }
  return rows
}

export function parseConditionsJson(text: string): PermissionConditions {
  const value: unknown = JSON.parse(text)
  if (value === null) return null
  if (typeof value !== "object" || Array.isArray(value))
    throw new Error("Conditions must be a JSON object or null.")
  return value as PermissionConditions
}

export function describeConditions(conditions: PermissionConditions): string {
  if (!conditions || !Object.keys(conditions).length) return "All records"
  const rows = rowsFromConditions(conditions)
  if (!rows) return JSON.stringify(conditions)
  return rows
    .map(
      (row) =>
        `${row.field} ${OPERATORS.find((item) => item.value === row.operator)?.label} ${row.source === "user" ? "current user" : row.source === "null" ? "empty" : row.value.replaceAll("\n", ", ")}`
    )
    .join(" and ")
}

/** The display name for a permission subject (`all` reads as "All"). */
export function permissionSubjectLabel(subject: string) {
  return subject === "all" ? "All" : subject
}
