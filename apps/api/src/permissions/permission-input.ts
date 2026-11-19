import { mongoQueryMatcher } from "@casl/ability"
import { conditionToSql } from "@et/authz"
import { permissionInputSchema as basePermissionInputSchema } from "@et/contracts"
import { getTableColumns } from "drizzle-orm"
import { SUBJECT_TABLES } from "../authz/subject-tables.js"

// Expose only values that survive JSON and are supported by the SQL matcher.
export const permissionOptions = Object.entries(SUBJECT_TABLES).map(
  ([subject, table]) => ({
    subject,
    fields: Object.entries(getTableColumns(table))
      .filter(([, column]) =>
        ["string", "boolean", "number"].includes(column.dataType)
      )
      .map(([name, column]) => ({
        name,
        type: column.dataType as "string" | "boolean" | "number",
        values: column.enumValues ?? [],
      })),
  })
)

export const permissionInputSchema = basePermissionInputSchema.superRefine(
  (input, ctx) => {
    if (input.conditions === null) return
    try {
      if (JSON.stringify(input.conditions).length > 16000)
        throw new Error("Conditions must be under 16 KB.")
      if (input.subject === "all")
        throw new Error("Choose a specific subject to add conditions.")
      // CASL's default matcher supports field conditions, not top-level logical operators.
      if (Object.keys(input.conditions).some((key) => key.startsWith("$"))) {
        throw new Error(
          "Use field conditions that all match. For alternatives, add another permission."
        )
      }
      conditionToSql(SUBJECT_TABLES[input.subject], input.conditions)
      mongoQueryMatcher(input.conditions)
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        path: ["conditions"],
        message: error instanceof Error ? error.message : "Invalid conditions.",
      })
    }
  }
)

export type PermissionInput = import("@et/contracts").PermissionInput
