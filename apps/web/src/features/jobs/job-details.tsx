import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  ArrowLeftIcon,
  BriefcaseIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileTextIcon,
  MailIcon,
  MessageSquareIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from "lucide-react"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Can } from "@/features/authz"
import { formatRecordDate } from "@/lib/format"
import { DeadlineBadge, deadlineState } from "./deadline"
import { JobStatusBadge } from "./job-values"
import { jobCvUrl, jobQueryOptions, prepareJob, setJobStatus } from "./jobs-api"
import { ScoreMeter } from "./match-evidence"

function LongText({ children }: { children: string | null }) {
  if (!children) {
    return (
      <p className="max-w-prose text-sm text-muted-foreground">
        Nothing here yet. Prepare the application to generate it.
      </p>
    )
  }
  return (
    <pre className="max-w-3xl whitespace-pre-wrap font-sans text-sm leading-6">
      {children}
    </pre>
  )
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-border/50 pb-2.5 last:border-0 last:pb-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-right text-sm">{value}</dd>
    </div>
  )
}

function ChipGroup({
  values,
  empty,
  muted = false,
}: {
  values: string[]
  empty: string
  muted?: boolean
}) {
  if (values.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {values.map((value) => (
        <Badge
          key={value}
          variant={muted ? "outline" : "secondary"}
          className={
            muted
              ? "text-xs font-normal text-muted-foreground"
              : "text-xs font-normal"
          }
        >
          {value}
        </Badge>
      ))}
    </div>
  )
}

/**
 * A posting is one record with generated documents attached, so the page is a
 * header plus a small tabbed workspace; each tab is a card sized to its content.
 */
export function JobDetails({ jobId }: { jobId: string }) {
  const queryClient = useQueryClient()
  const { data: job } = useSuspenseQuery(jobQueryOptions(jobId))

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["jobs"] })
  }

  const prepare = useMutation({
    mutationFn: () => prepareJob(job.id),
    onSuccess: () => {
      refresh()
      toast.success("Tailored CV and cover letter ready to review.")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const decide = useMutation({
    mutationFn: (status: "applied" | "dismissed" | "prepared") =>
      setJobStatus(job.id, status),
    onSuccess: (updated) => {
      refresh()
      toast.success(
        updated.status === "applied"
          ? "Marked as applied."
          : updated.status === "dismissed"
            ? "Dismissed."
            : "Moved back to prepared."
      )
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const meta = [job.company, job.location, `via @${job.channel}`]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="pt-8">
      <Link
        to="/jobs"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        All matches
      </Link>

      <header className="mt-3 border-b border-border/60 pb-6">
        <h1 className="max-w-3xl text-2xl font-semibold tracking-tight text-balance">
          {job.title ?? "Untitled post"}
        </h1>
        {meta ? (
          <p className="mt-1.5 text-sm text-muted-foreground">{meta}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ScoreMeter score={job.score} size="lg" />
          <JobStatusBadge status={job.status} />
          {job.matchedSkills.slice(0, 5).map((skill) => (
            <Badge key={skill} variant="secondary" className="font-normal">
              {skill}
            </Badge>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {job.url ? (
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ExternalLinkIcon data-icon="inline-start" />
              Open post
            </a>
          ) : null}

          <Can I="update" a="JobPost">
            {!job.blocked ? (
              <Button
                size="sm"
                disabled={prepare.isPending}
                onClick={() => prepare.mutate()}
              >
                <SparklesIcon data-icon="inline-start" />
                {prepare.isPending
                  ? "Writing…"
                  : job.tailoredCv
                    ? "Prepare again"
                    : "Prepare application"}
              </Button>
            ) : null}

            {job.status === "applied" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={decide.isPending}
                onClick={() => decide.mutate("prepared")}
              >
                Reopen
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={decide.isPending}
                onClick={() => decide.mutate("applied")}
              >
                Mark applied
              </Button>
            )}

            {job.status !== "dismissed" ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={decide.isPending}
                onClick={() => decide.mutate("dismissed")}
              >
                Dismiss
              </Button>
            ) : null}
          </Can>
        </div>
      </header>

      <Tabs defaultValue="overview" className="mt-6">
        <div className="border-b border-border/60">
          <TabsList variant="line" className="justify-start gap-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="cv">Tailored CV</TabsTrigger>
            <TabsTrigger value="cover">Cover letter</TabsTrigger>
            <TabsTrigger value="posting">Original post</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="overview"
          className="mt-4 grid items-start gap-4 md:grid-cols-2"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SparklesIcon className="size-4 text-muted-foreground" />
                Why it matched
              </CardTitle>
              <CardDescription>
                What the scorer found in this post, and what it could not check.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <section className="space-y-2">
                <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Signals
                </h3>
                <ChipGroup
                  values={job.reasons}
                  empty="No signals were found in the post."
                />
              </section>
              <section className="space-y-2 border-t border-border/50 pt-4">
                <h3 className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <TriangleAlertIcon className="size-3.5" />
                  Gaps
                </h3>
                <ChipGroup values={job.gaps} empty="None noted." muted />
              </section>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BriefcaseIcon className="size-4 text-muted-foreground" />
                Posting
              </CardTitle>
              <CardDescription>
                Where it came from, and how far it has moved.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2.5">
                <Detail label="Channel" value={`@${job.channel}`} />
                <Detail
                  label="Posted"
                  value={
                    job.postedAt ? formatRecordDate(job.postedAt) : "Unknown"
                  }
                />
                <Detail label="Found" value={formatRecordDate(job.createdAt)} />
                <Detail
                  label="Closes"
                  value={
                    deadlineState(job.deadlineAt) === "none" ? (
                      <span className="text-muted-foreground">Not stated</span>
                    ) : (
                      <DeadlineBadge value={job.deadlineAt} />
                    )
                  }
                />
                <Detail
                  label="Prepared"
                  value={
                    job.preparedAt
                      ? formatRecordDate(job.preparedAt)
                      : "Not yet"
                  }
                />
                <Detail
                  label="Applied"
                  value={
                    job.appliedAt ? formatRecordDate(job.appliedAt) : "Not yet"
                  }
                />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cv" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileTextIcon className="size-4 text-muted-foreground" />
                Tailored CV
              </CardTitle>
              <CardDescription>
                Written from your profile for this posting.
              </CardDescription>
              {job.tailoredCv ? (
                <CardAction>
                  <a
                    href={jobCvUrl(job.id)}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    <DownloadIcon data-icon="inline-start" />
                    .docx
                  </a>
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent>
              <LongText>{job.tailoredCv}</LongText>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cover" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MailIcon className="size-4 text-muted-foreground" />
                Cover letter
              </CardTitle>
              <CardDescription>
                Separate from the CV, and specific to this posting.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LongText>{job.coverLetter}</LongText>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="posting" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquareIcon className="size-4 text-muted-foreground" />
                Original post
              </CardTitle>
              <CardDescription>
                Exactly as it arrived from @{job.channel}.
              </CardDescription>
              {job.url ? (
                <CardAction>
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    <ExternalLinkIcon data-icon="inline-start" />
                    Telegram
                  </a>
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent>
              <pre className="max-w-3xl whitespace-pre-wrap font-sans text-sm leading-6 text-foreground/90">
                {job.rawText}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
