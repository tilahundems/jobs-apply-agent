import { createFileRoute, redirect } from "@tanstack/react-router"

import { getSession, SignupPage } from "@/features/auth"

export const Route = createFileRoute("/signup")({
  beforeLoad: async () => {
    const session = await getSession()

    if (session) {
      throw redirect({ to: "/dashboard" })
    }
  },
  component: SignupPage,
})
