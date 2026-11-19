import { integer } from "drizzle-orm/sqlite-core"

/**
 * Timestamps are stored as Unix seconds in an INTEGER column. Drizzle maps them
 * back to `Date`, so services keep comparing `Date` objects, and SQLite can
 * format them with `strftime(..., 'unixepoch')`.
 */
export const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())

export const updatedAt = () =>
  integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
