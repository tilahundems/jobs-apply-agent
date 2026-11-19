import type { Session } from "./auth-client"
import { authClient } from "./auth-client"

export async function getSession(): Promise<Session | null> {
  const { data, error } = await authClient.getSession()
  return error ? null : data
}
