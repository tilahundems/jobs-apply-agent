import { useQueryErrorResetBoundary } from "@tanstack/react-query"
import {
  createFileRoute,
  Link,
  notFound,
  useRouter,
} from "@tanstack/react-router"
import { FolderIcon } from "lucide-react"
import { useEffect } from "react"
import {
  DetailEmpty,
  DetailError,
  DetailPagePending,
} from "@/components/detail-page"
import { buttonVariants } from "@/components/ui/button"
import { CanView, canReadSubject, requirePageAbility } from "@/features/authz"
import { projectQueryOptions } from "@/features/projects/projects-api"
import { ProjectDetails } from "@/features/projects/projects-details"
import { tagsQueryOptions } from "@/features/tags"
import { tasksQueryOptions } from "@/features/tasks"
import { usersQueryOptions } from "@/features/users"

export const Route = createFileRoute("/_main/projects/$projectId")({
  beforeLoad: ({ context }) => {
    requirePageAbility(context.rules, "read", "Project")
  },
  loader: async ({ context, params }) => {
    try {
      await Promise.all([
        context.queryClient.ensureQueryData(
          projectQueryOptions(params.projectId)
        ),
        canReadSubject(context.rules, "Task")
          ? context.queryClient.ensureQueryData(tasksQueryOptions)
          : Promise.resolve(),
        canReadSubject(context.rules, "Tag")
          ? context.queryClient.ensureQueryData(tagsQueryOptions)
          : Promise.resolve(),
        canReadSubject(context.rules, "User")
          ? context.queryClient.ensureQueryData(usersQueryOptions)
          : Promise.resolve(),
      ])
    } catch (error) {
      if (error instanceof Error && error.message === "Project not found") {
        throw notFound()
      }

      throw error
    }
  },
  pendingComponent: DetailPagePending,
  errorComponent: ProjectDetailsError,
  notFoundComponent: ProjectDetailsNotFound,
  component: ProjectDetailsPage,
})

function ProjectDetailsNotFound() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <DetailEmpty
        icon={FolderIcon}
        title="Project not found"
        description="This project may have been deleted, or the link is incorrect."
        action={
          <Link
            to="/projects"
            className={buttonVariants({ variant: "outline" })}
          >
            Back To Projects
          </Link>
        }
      />
    </div>
  )
}

function ProjectDetailsError({ error }: { error: Error }) {
  const router = useRouter()
  const queryErrorResetBoundary = useQueryErrorResetBoundary()

  useEffect(() => {
    queryErrorResetBoundary.reset()
  }, [queryErrorResetBoundary])

  return (
    <DetailError
      message={error.message || "Unable to load project"}
      onRetry={() => void router.invalidate()}
    />
  )
}

function ProjectDetailsPage() {
  const { projectId } = Route.useParams()

  return (
    <CanView a="Project">
      <ProjectDetails projectId={projectId} />
    </CanView>
  )
}
