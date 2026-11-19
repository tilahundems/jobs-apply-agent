import { useQueryErrorResetBoundary } from "@tanstack/react-query"
import {
  createFileRoute,
  Link,
  notFound,
  useRouter,
} from "@tanstack/react-router"
import { BriefcaseIcon } from "lucide-react"
import { useEffect } from "react"
import {
  DetailEmpty,
  DetailError,
  DetailPagePending,
} from "@/components/detail-page"
import { buttonVariants } from "@/components/ui/button"
import { CanView, requirePageAbility } from "@/features/authz"
import { JobDetails, jobQueryOptions } from "@/features/jobs"

export const Route = createFileRoute("/_main/jobs/$jobId")({
  beforeLoad: ({ context }) => {
    requirePageAbility(context.rules, "read", "JobPost")
  },
  loader: async ({ context, params }) => {
    try {
      await context.queryClient.ensureQueryData(jobQueryOptions(params.jobId))
    } catch (error) {
      if (error instanceof Error && error.message === "Job not found") {
        throw notFound()
      }
      throw error
    }
  },
  pendingComponent: DetailPagePending,
  errorComponent: JobDetailsError,
  notFoundComponent: JobDetailsNotFound,
  component: JobDetailsPage,
})

function JobDetailsNotFound() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <DetailEmpty
        icon={BriefcaseIcon}
        title="Job not found"
        description="This posting may have been removed, or the link is incorrect."
        action={
          <Link to="/jobs" className={buttonVariants({ variant: "outline" })}>
            Back To Matches
          </Link>
        }
      />
    </div>
  )
}

function JobDetailsError({ error }: { error: Error }) {
  const router = useRouter()
  const queryErrorResetBoundary = useQueryErrorResetBoundary()

  useEffect(() => {
    queryErrorResetBoundary.reset()
  }, [queryErrorResetBoundary])

  return (
    <DetailError
      message={error.message || "Unable to load job"}
      onRetry={() => void router.invalidate()}
    />
  )
}

function JobDetailsPage() {
  const { jobId } = Route.useParams()

  return (
    <CanView a="JobPost">
      <JobDetails jobId={jobId} />
    </CanView>
  )
}
