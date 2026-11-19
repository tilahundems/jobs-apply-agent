import { createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/page-header"
import { RouteError } from "@/components/route-error"
import { CanView, requirePageAbility } from "@/features/authz"
import { TagsTable, tagPageQueryOptions } from "@/features/tags"
import { tagTableSearch } from "@/features/tags/tags-table-columns"

export const Route = createFileRoute("/_main/tags/")({
  validateSearch: tagTableSearch.validateSearch,
  beforeLoad: ({ context }) => {
    requirePageAbility(context.rules, "read", "Tag")
  },
  loaderDeps: ({ search }) => tagTableSearch.toQuery(search),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(tagPageQueryOptions(deps)),
  errorComponent: RouteError,
  component: TagsPage,
})

function TagsPage() {
  return (
    <CanView a="Tag">
      <div className="flex flex-col gap-4 pt-2 pb-4 lg:pt-3 lg:pb-6">
        <PageHeader
          title="Tags"
          subtitle="Label and organize projects with reusable tags."
        />
        <TagsTable />
      </div>
    </CanView>
  )
}
