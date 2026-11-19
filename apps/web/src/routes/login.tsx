import { createFileRoute, redirect } from "@tanstack/react-router"

import { getSession, LoginPage } from "@/features/auth"

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const session = await getSession()

    if (session) {
      throw redirect({ to: "/dashboard" })
    }
  },
  component: LoginPage,
})
