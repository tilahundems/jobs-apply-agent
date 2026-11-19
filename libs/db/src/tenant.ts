import { AsyncLocalStorage } from "node:async_hooks"
import { type AnyColumn, eq } from "drizzle-orm"
import type { Database } from "./client.js"
import { env } from "./env.js"
import type { DatabaseTransaction } from "./locks.js"

/** Reserved for installations that do not use organizations. */
export const SINGLE_TENANT_ID = "__single_tenant__"

/** `tx` is a real transaction inside one, and the plain handle otherwise. */
type TenantContext = {
  organizationId: string
  tx: Database | DatabaseTransaction
}
const context = new AsyncLocalStorage<TenantContext>()

export function currentOrganizationId() {
  return context.getStore()?.organizationId ?? null
}

export function requiredOrganizationId() {
  const organizationId = currentOrganizationId()
  if (!organizationId && !env.MULTI_TENANCY) return SINGLE_TENANT_ID
  if (!organizationId) throw new Error("Tenant database context is required")
  return organizationId
}

export function tenantWhere(column: AnyColumn) {
  return eq(column, requiredOrganizationId())
}

export function tenantClient(base: Database): Database {
  return new Proxy(base, {
    get(target, property) {
      const store = context.getStore()
      if (property === "transaction") {
        return store
          ? store.tx.transaction.bind(store.tx)
          : target.transaction.bind(target)
      }
      const client = store?.tx ?? target
      return Reflect.get(client, property, client)
    },
  })
}

/**
 * Publishes the tenant for `tenantWhere()`. SQLite has no session-scoped
 * setting for row-level security, so isolation comes from the predicates, not
 * from a database transaction — and opening one per request would take a write
 * lock (BEGIN IMMEDIATE) for reads too, making any two requests conflict.
 * Work that needs atomicity opens its own transaction through `db`.
 */
export async function withTenantContext<T>(
  base: Database,
  organizationId: string,
  work: () => Promise<T>
): Promise<T> {
  if (context.getStore()) throw new Error("Tenant context is already active")
  return context.run({ organizationId, tx: base }, work)
}

/** Runs `work` in one transaction with the tenant published. */
export async function withTenantTransaction<T>(
  base: Database,
  organizationId: string,
  work: () => Promise<T>
): Promise<T> {
  if (context.getStore()) throw new Error("Tenant context is already active")
  return base.transaction(async (tx) =>
    context.run({ organizationId, tx }, work)
  )
}
