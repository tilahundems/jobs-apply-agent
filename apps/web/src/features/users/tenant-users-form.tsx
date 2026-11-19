import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouteContext, useRouter } from "@tanstack/react-router"
import { PlusIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { authClient } from "@/features/auth/auth-client"
import { navigateAfterSessionChange } from "@/features/auth/session-cache"
import { Can } from "@/features/authz"
import { useTenantMemberManager } from "./use-tenant-member-manager"
import {
  rolesQueryOptions,
  type User,
  updateUser,
  usersQueryOptions,
} from "./users-api"

export function TenantUsersForm({
  user,
  open: controlledOpen,
  onOpenChange,
  showTrigger,
}: {
  user?: User
  open?: boolean
  onOpenChange?: (open: boolean) => void
  showTrigger?: boolean
}) {
  const { session } = useRouteContext({ from: "/_main" })
  const activeId =
    "activeOrganizationId" in session.session
      ? (session.session.activeOrganizationId as string | null)
      : null
  const queryClient = useQueryClient()
  const canManage = useTenantMemberManager()
  const router = useRouter()
  const [localOpen, setLocalOpen] = useState(false)
  const open = controlledOpen ?? localOpen
  const [email, setEmail] = useState("")
  const [roleId, setRoleId] = useState(user?.roles?.[0]?.id ?? "")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const { data: roles = [] } = useQuery({
    ...rolesQueryOptions,
    enabled: open && !!user,
  })

  function setOpen(value: boolean) {
    if (controlledOpen === undefined) setLocalOpen(value)
    onOpenChange?.(value)
    if (value) {
      setRoleId(user?.roles?.[0]?.id ?? "")
      setCode("")
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeId || !canManage || busy) return
    setBusy(true)
    if (!user) {
      const result = await authClient.organization.inviteMember({
        organizationId: activeId,
        email: email.trim(),
        role: "member",
      })
      setBusy(false)
      if (result.error || !result.data) {
        toast.error(result.error?.message ?? "Unable to invite member")
        return
      }
      setCode(result.data.id)
      setEmail("")
      toast.success("Invitation created")
      return
    }
    try {
      await updateUser(user.id, { name: user.name, roleId })
      await queryClient.invalidateQueries(usersQueryOptions)
      if (user.id === session.user.id) {
        await navigateAfterSessionChange(queryClient, router, "/settings/users")
      }
      toast.success("Member role updated")
      setOpen(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update role"
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {user || showTrigger === false || !canManage ? null : (
        <Can I="create" a="User">
          <DialogTrigger render={<Button size="sm" />}>
            <PlusIcon /> Invite member
          </DialogTrigger>
        </Can>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {user ? "Change member role" : "Invite member"}
          </DialogTitle>
          <DialogDescription>
            {user
              ? "Assign a role in this organization."
              : "Invite by email. You can assign a workspace role after the invitation is accepted."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)} className="grid gap-4">
          {user ? (
            <>
              <p className="text-sm">
                {user.name} ({user.email})
              </p>
              <label className="grid gap-1 text-sm">
                Role
                <select
                  aria-label="Workspace role"
                  className="h-8 rounded-md border bg-background px-2"
                  value={roleId}
                  onChange={(event) => setRoleId(event.target.value)}
                  required
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <Input
              type="email"
              aria-label="Invite email"
              placeholder="Email address"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          )}
          {code ? (
            <p className="break-all text-sm">
              Share invitation code: <strong>{code}</strong>
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="submit"
              disabled={busy || (user ? !roleId : !email.trim())}
            >
              {user ? "Save role" : "Invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
