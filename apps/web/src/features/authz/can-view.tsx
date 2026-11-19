import { Can } from "@casl/react"
import { Link } from "@tanstack/react-router"
import { ShieldXIcon } from "lucide-react"
import type { ReactNode } from "react"
import { buttonVariants } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

import type { Action } from "./ability"
import type { PageSubject } from "./page-ability"

const SUBJECT_LABELS: Record<PageSubject, string> = {
  JobPost: "jobs",
  CandidateProfile: "your profile",
  Project: "projects",
  Task: "tasks",
  Tag: "tags",
  User: "users",
  Role: "roles",
  Permission: "permissions",
  AuditLog: "audit logs",
}

export function ForbiddenView({ subject }: { subject: PageSubject }) {
  return (
    <div className="flex flex-1 flex-col px-4 py-6 lg:px-6">
      <Empty className="border border-dashed py-10">
        <EmptyHeader>
          <EmptyMedia
            variant="icon"
            className="size-12 rounded-full text-muted-foreground"
          >
            <ShieldXIcon className="size-6" />
          </EmptyMedia>
          <EmptyTitle>You don&apos;t have access</EmptyTitle>
          <EmptyDescription>
            You don&apos;t have permission to view {SUBJECT_LABELS[subject]}.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link
            to="/dashboard"
            className={buttonVariants({ variant: "outline" })}
          >
            Back To Dashboard
          </Link>
        </EmptyContent>
      </Empty>
    </div>
  )
}

export function CanView({
  I = "read",
  a,
  children,
}: {
  I?: Action
  a: PageSubject
  children: ReactNode
}) {
  return (
    <Can I={I} a={a} passThrough>
      {({ isAllowed }) =>
        isAllowed ? children : <ForbiddenView subject={a} />
      }
    </Can>
  )
}
