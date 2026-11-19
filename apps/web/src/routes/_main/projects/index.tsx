import { createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/page-header"
import { RouteError } from "@/components/route-error"
import { CanView, canReadSubject, requirePageAbility } from "@/features/authz"
import { ProjectsTable, projectPageQueryOptions } from "@/features/projects"
import { projectTableSearch } from "@/features/projects/projects-table-columns"
import { tagsQueryOptions } from "@/features/tags"

export const Route = createFileRoute("/_main/projects/")({
  validateSearch: projectTableSearch.validateSearch,
  beforeLoad: ({ context }) => {
    requirePageAbility(context.rules, "read", "Project")
  },
  loaderDeps: ({ search }) => projectTableSearch.toQuery(search),
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(projectPageQueryOptions(deps)),
      canReadSubject(context.rules, "Tag")
        ? context.queryClient.ensureQueryData(tagsQueryOptions)
        : Promise.resolve(),
    ]),
  errorComponent: RouteError,
  component: ProjectsPage,
})

function ProjectsPage() {
  return (
    <CanView a="Project">
      <div className="flex flex-col gap-4 pt-2 pb-4 lg:pt-3 lg:pb-6">
        <PageHeader
          title="Projects"
          subtitle="Create and manage projects for your workspace."
        />
        <ProjectsTable />
      </div>
    </CanView>
  )
}
