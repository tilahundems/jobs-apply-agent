import { createFileRoute } from "@tanstack/react-router"

import { RouteError } from "@/components/route-error"
import { MatchesPage } from "@/features/agent"
import { matchesSearch } from "@/features/agent/matches-search"
import { CanView, requirePageAbility } from "@/features/authz"
import { jobPageQueryOptions } from "@/features/jobs"

export const Route = createFileRoute("/_main/jobs/")({
  validateSearch: matchesSearch.validateSearch,
  beforeLoad: ({ context }) => {
    requirePageAbility(context.rules, "read", "JobPost")
  },
  loaderDeps: ({ search }) => matchesSearch.toQuery(search),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(jobPageQueryOptions(deps)),
  errorComponent: RouteError,
  component: MatchesRoute,
})

function MatchesRoute() {
  return (
    <CanView a="JobPost">
      <MatchesPage />
    </CanView>
  )
}
