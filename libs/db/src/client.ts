import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"

import { databaseFile } from "./env.js"
import * as schema from "./schema.js"
import { tenantClient } from "./tenant.js"

mkdirSync(dirname(databaseFile), { recursive: true })

const client = createClient({ url: `file:${databaseFile}` })

export const rootDb = drizzle(client, { schema })
export const db = tenantClient(rootDb)

export async function closeDb() {
  client.close()
}

export const databaseUrl = `file:${databaseFile}`
export type Database = typeof rootDb
