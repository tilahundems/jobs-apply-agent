import { closeDb, databaseUrl, rootDb } from "./client.js"
import { migrateDatabase } from "./migrations.js"

try {
  await migrateDatabase(rootDb)
  console.log(`Migrated ${databaseUrl}`)
} finally {
  await closeDb()
}
