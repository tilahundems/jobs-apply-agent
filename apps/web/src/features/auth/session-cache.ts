import type { QueryClient } from "@tanstack/react-query"
import { hashKey } from "@tanstack/react-query"

const scopes = new WeakMap<QueryClient, string>()

/** Partition cached server data by account and effective permissions. */
export async function setSessionScope(
  client: QueryClient,
  userId: string,
  rules: unknown,
  organizationId?: string | null
) {
  const scope = hashKey([userId, organizationId ?? null, rules])
  if (scopes.get(client) === scope) return
  await client.cancelQueries()
  client.clear()
  const defaults = client.getDefaultOptions()
  client.setDefaultOptions({
    ...defaults,
    queries: {
      ...defaults.queries,
      queryKeyHashFn: (key) => hashKey([scope, ...key]),
    },
  })
  scopes.set(client, scope)
}

export async function clearSessionCache(
  client: QueryClient,
  router: { clearCache: () => void }
) {
  await client.cancelQueries()
  client.clear()
  scopes.delete(client)
  router.clearCache()
}

export async function navigateAfterSessionChange(
  client: QueryClient,
  router: { clearCache: () => void },
  to: string
) {
  await clearSessionCache(client, router)
  // A fresh document also removes mounted observers, route context, and abilities.
  window.location.replace(to)
}
