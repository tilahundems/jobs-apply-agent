import { organizationClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  baseURL:
    (import.meta.env.VITE_API_URL as string | undefined) ??
    window.location.origin,
  basePath: "/api/v1/auth",
  plugins: [organizationClient()],
})

export type Session = typeof authClient.$Infer.Session
