import { createFileRoute, redirect } from "@tanstack/react-router"

import { getSession } from "@/features/auth"

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const session = await getSession()

    if (!session) {
      throw redirect({ to: "/login" })
    }

    throw redirect({ to: "/dashboard" })
  },
})
