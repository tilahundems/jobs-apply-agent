import { fileURLToPath } from "node:url"
import { migrate } from "drizzle-orm/libsql/migrator"
import type { Database } from "./client.js"

export const migrationFolder = fileURLToPath(
  new URL("../drizzle", import.meta.url)
)

/**
 * Applies the pending Drizzle migrations to the SQLite file. SQLite serialises
 * writers, so the Postgres advisory lock this replaced is unnecessary.
 */
export async function migrateDatabase(database: Database) {
  await migrate(database, { migrationsFolder: migrationFolder })
}
