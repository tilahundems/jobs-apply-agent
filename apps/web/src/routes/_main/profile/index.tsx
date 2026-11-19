import { createFileRoute } from "@tanstack/react-router"

import { RouteError } from "@/components/route-error"
import { CanView, requirePageAbility } from "@/features/authz"
import { profileQueryOptions } from "@/features/profile/profile-api"
import { ProfilePage } from "@/features/profile/profile-page"

export const Route = createFileRoute("/_main/profile/")({
  beforeLoad: ({ context }) => {
    requirePageAbility(context.rules, "read", "CandidateProfile")
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(profileQueryOptions),
  errorComponent: RouteError,
  component: ProfileSettingsPage,
})

function ProfileSettingsPage() {
  return (
    <CanView a="CandidateProfile">
      <div className="pt-8">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
          What the agent knows about you. It scores every posting and writes
          every application from this page alone.
        </p>
        <div className="mt-6">
          <ProfilePage />
        </div>
      </div>
    </CanView>
  )
}
