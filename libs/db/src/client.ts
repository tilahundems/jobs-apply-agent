import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { type Client, createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"

import { databaseFile } from "./env.js"
import * as schema from "./schema.js"
import { tenantClient } from "./tenant.js"

mkdirSync(dirname(databaseFile), { recursive: true })

const base = createClient({ url: `file:${databaseFile}` })

// The default rollback journal makes a write wait for, and a reader fail
// against, whatever else is mid-flight: a channel scan writing for a minute
// while the UI polls is enough to surface SQLITE_BUSY as a spurious conflict.
// WAL is recorded in the file header, so switching once is enough and readers
// then continue during a write.
for (const pragma of [
  "PRAGMA journal_mode = WAL",
  "PRAGMA synchronous = NORMAL",
]) {
  await base.execute(pragma)
}

/** Attempts per statement before a lock conflict is reported to the caller (~6s of waiting). */
const BUSY_RETRIES = 8

function sqliteCode(error: unknown): string | null {
  let current: unknown = error
  for (let depth = 0; current instanceof Error && depth < 5; depth++) {
    const { code, extendedCode } = current as {
      code?: unknown
      extendedCode?: unknown
    }
    if (typeof code === "string") return code
    if (typeof extendedCode === "string") return extendedCode
    current = (current as { cause?: unknown }).cause
  }
  return null
}

function isBusy(error: unknown) {
  const code = sqliteCode(error)
  return code !== null && /BUSY|LOCKED/.test(code)
}

/**
 * Waits out a lock instead of failing. `busy_timeout` is a per-connection
 * setting and libsql runs statements on a pool, so it cannot be set once at
 * open; retrying the statement is what makes a second writer queue up.
 */
async function retryBusy<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run()
    } catch (error) {
      if (!isBusy(error) || attempt >= BUSY_RETRIES) throw error
      await new Promise((resolve) => setTimeout(resolve, 20 * 2 ** attempt))
    }
  }
}

const RETRIED = new Set(["execute", "batch", "migrate"])

function busySafe<T extends object>(target: T): T {
  return new Proxy(target, {
    get(object, property, receiver) {
      const value = Reflect.get(object, property, receiver)
      if (typeof value !== "function") return value
      if (property === "transaction") {
        return async (...args: unknown[]) =>
          busySafe(await value.apply(object, args))
      }
      if (typeof property === "string" && RETRIED.has(property)) {
        return (...args: unknown[]) =>
          retryBusy(() => value.apply(object, args))
      }
      return value.bind(object)
    },
  })
}

const client = busySafe(base) as Client

export const rootDb = drizzle(client, { schema })
export const db = tenantClient(rootDb)

export async function closeDb() {
  client.close()
}

export const databaseUrl = `file:${databaseFile}`
export type Database = typeof rootDb
