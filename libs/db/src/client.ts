import { AsyncLocalStorage } from "node:async_hooks"
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
        // The write lock is taken when the transaction opens, so retrying this
        // call is safe: no work has run yet.
        return (...args: unknown[]) =>
          retryBusy(() => value.apply(object, args))
      }
      if (typeof property === "string" && RETRIED.has(property)) {
        return (...args: unknown[]) =>
          retryBusy(() => value.apply(object, args))
      }
      return value.bind(object)
    },
  })
}

/** Marks work that already holds the write lock, so nested calls queue-free. */
const holdingWriteLock = new AsyncLocalStorage<true>()

let writeQueue: Promise<unknown> = Promise.resolve()

/**
 * SQLite allows a single writer, and libsql's pooled local client does not
 * recover once two of its transactions race for the write lock: it keeps
 * reporting `cannot commit transaction - SQL statements in progress`. Queueing
 * transactions in this process means they wait instead of racing; writes from
 * another process still surface as BUSY and are retried.
 */
function serialized<T>(run: () => Promise<T>): Promise<T> {
  if (holdingWriteLock.getStore()) return run()
  const result = writeQueue.then(
    () => holdingWriteLock.run(true, run),
    () => holdingWriteLock.run(true, run)
  )
  writeQueue = result.catch(() => undefined)
  return result
}

/**
 * A transaction keeps the snapshot it opened with, so a lock conflict inside
 * one can never be retried in place: re-running the statement fails again or
 * commits over a stale snapshot. Retrying the whole transaction is the only
 * correct unit, which is why statements inside a transaction are left alone
 * and the transaction call itself is wrapped instead.
 */
function retryTransactions<T extends object>(target: T): T {
  return new Proxy(target, {
    get(object, property, receiver) {
      const value = Reflect.get(object, property, receiver)
      if (property !== "transaction" || typeof value !== "function") {
        return value
      }
      return (...args: unknown[]) =>
        serialized(() => retryBusy(() => value.apply(object, args)))
    },
  })
}

const client = busySafe(base) as Client

export const rootDb = retryTransactions(drizzle(client, { schema }))
export const db = tenantClient(rootDb)

export async function closeDb() {
  client.close()
}

export const databaseUrl = `file:${databaseFile}`
export type Database = typeof rootDb
