import { createFileRoute } from "@tanstack/react-router"

import { RouteError } from "@/components/route-error"
import { ConsolePage } from "@/features/agent"

export const Route = createFileRoute("/_main/dashboard/")({
  errorComponent: RouteError,
  component: ConsolePage,
})
