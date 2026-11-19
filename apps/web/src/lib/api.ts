const apiOrigin =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? ""

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json")
  const response = await fetch(`${apiOrigin}${path}`, {
    ...init,
    headers,
    credentials: "include",
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string
    } | null
    throw new ApiError(
      payload?.error ?? `Request failed (${response.status})`,
      response.status
    )
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function json(
  method: "POST" | "PUT" | "PATCH",
  value: unknown
): RequestInit {
  return { method, body: JSON.stringify(value) }
}
