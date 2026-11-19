import type { Database } from "./client.js"

export type DatabaseTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0]

/**
 * Postgres needed an advisory lock because several connections could assign
 * roles at once. SQLite allows a single writer and the assignment runs inside a
 * transaction, so the serialisation happens in the database itself.
 */
export async function lockRoleAssignments(_tx: DatabaseTransaction) {
  return
}
